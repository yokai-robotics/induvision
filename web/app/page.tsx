"use client";

import Image from "next/image";
import {
  Activity,
  Aperture,
  Camera as CameraIcon,
  CheckCircle2,
  Database,
  Trash2,
  Gauge,
  Github,
  Network,
  Pencil,
  Plus,
  Ruler,
  ScanLine,
  Settings2,
  SlidersHorizontal,
  TriangleAlert,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { cameraMegapixels, filterCameras, formatNumber, objectPixelsAtDistance, rankConfigurations, simulateConfiguration } from "./calculations";
import { initialStudyConfig } from "./data";
import { Camera, Lens, NumericValue, Study, StudyConfig } from "./types";
import catalog from "../data/catalog.generated.json";
import { CatalogPanel } from "../components/CatalogPanel";
import { MAX_IMPORT_BYTES, STUDIES_KEY, mergeImportedStudies, parseStudies, repairReferences, serializeStudies, writeStudies } from "../lib/studies";

const catalogCameras = catalog.cameras as Camera[];
const catalogLenses = catalog.lenses as Lens[];

function downloadStudies(studies: Study[]) {
  const url = URL.createObjectURL(new Blob([serializeStudies(studies)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "induvision-etudes.json";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Tab = "study" | "cameras" | "lenses" | "network";
type RankedMatch = ReturnType<typeof rankConfigurations>[number];
type ComparisonPair = {
  cameraId: string;
  lensId: string;
};
type StudyEditableKey = keyof Pick<
  Study,
  | keyof StudyConfig
  | "objectWidthCm"
  | "objectHeightCm"
  | "objectLengthCm"
  | "sensorFormats"
  | "fpsMin"
  | "fpsMax"
  | "resolutionMpMin"
  | "resolutionMpMax"
  | "selectedCameraId"
  | "selectedLensId"
  | "comparisonPairs"
>;

const ui = {
  eyebrow: "eyebrow",
  panel: "panel",
  panelTitle: "panel-title",
  field: "mb-4 grid min-w-0 gap-2",
  fieldLabel: "text-xs font-semibold text-muted",
  control: "control",
  primaryButton: "cta cta-primary w-full",
  iconButton: "icon-button",
  formGrid: "grid grid-cols-1 gap-4 md:grid-cols-2"
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function createDefaultStudy(name = "Nouvelle étude"): Study {
  return {
    id: "",
    name,
    ...initialStudyConfig,
    objectTravelAxis: initialStudyConfig.objectTravelAxis,
    sensorFormats: "[]",
    fpsMin: null,
    fpsMax: null,
    resolutionMpMin: null,
    resolutionMpMax: null,
    selectedCameraId: "",
    selectedLensId: "",
    comparisonPairs: "[]"
  };
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function positiveNumber(value: NumericValue) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function parseNumberInput(value: string): NumericValue {
  if (value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function resolveExistingId<T extends { id: string }>(preferredId: string | undefined, items: T[]) {
  return items.some((item) => item.id === preferredId) ? preferredId ?? "" : items[0]?.id ?? "";
}

function parseComparisonPairs(value: string | undefined): ComparisonPair[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const cameraId = optionalString((item as Record<string, unknown>).cameraId);
        const lensId = optionalString((item as Record<string, unknown>).lensId);
        return cameraId && lensId ? { cameraId, lensId } : null;
      })
      .filter(Boolean) as ComparisonPair[];
  } catch {
    return [];
  }
}

function parseSensorFormats(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  } catch {
    return [];
  }
}

function serializeSensorFormats(values: string[]) {
  return JSON.stringify(values.filter((value) => value.trim().length > 0));
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "fr", { numeric: true, sensitivity: "base" })
  );
}

function uniqueNumbers(values: number[]) {
  return Array.from(new Set(values.map((value) => Number(value.toFixed(2))))).sort((a, b) => a - b);
}

function serializeComparisonKeys(keys: string[]): string {
  return JSON.stringify(
    keys
      .map((key) => {
        const [cameraId, lensId] = key.split("::");
        return cameraId && lensId ? { cameraId, lensId } : null;
      })
      .filter(Boolean)
  );
}

function comparisonKeysFromStudy(study: Study, fallbackMatches: RankedMatch[]) {
  const savedKeys = parseComparisonPairs(study.comparisonPairs).map((pair) => `${pair.cameraId}::${pair.lensId}`);
  return study.comparisonPairs !== undefined ? savedKeys : fallbackMatches.slice(0, 3).map(matchKey);
}

function resolveMatchKey(
  key: string,
  matches: RankedMatch[],
  cameras: Camera[],
  lenses: Lens[],
  study: Study
): RankedMatch | null {
  const existing = matches.find((match) => matchKey(match) === key);
  if (existing) return existing;

  const [cameraId, lensId] = key.split("::");
  const camera = cameras.find((item) => item.id === cameraId);
  const lens = lenses.find((item) => item.id === lensId);
  return camera && lens ? { camera, lens, result: simulateConfiguration(study, camera, lens) } : null;
}

function parseBitDepth(value: string) {
  const numbers = value.match(/\d+(?:[,.]\d+)?/g)?.map((item) => Number(item.replace(",", "."))).filter(Number.isFinite) ?? [];
  return numbers[0] ?? 8;
}

function networkThroughput(params: { width: NumericValue; height: NumericValue; fps: NumericValue; bitDepth: NumericValue; cameraCount: NumericValue; overheadPercent: NumericValue }) {
  const width = positiveNumber(params.width);
  const height = positiveNumber(params.height);
  const bitDepth = positiveNumber(params.bitDepth);
  const fps = positiveNumber(params.fps);
  const cameraCount = Math.max(1, positiveNumber(params.cameraCount));
  const overheadPercent = Math.max(0, positiveNumber(params.overheadPercent));
  const pixelsPerFrame = width * height;
  const usefulMbps = (pixelsPerFrame * bitDepth * fps * cameraCount) / 1_000_000;
  const networkMbps = usefulMbps * (1 + overheadPercent / 100);
  return {
    pixelsPerFrame,
    usefulMbps,
    networkMbps,
    networkGbps: networkMbps / 1000
  };
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("study");
  const [studies, setStudies] = useState<Study[]>([]);
  const [activeStudyId, setActiveStudyId] = useState("");
  const cameras = catalogCameras;
  const lenses = catalogLenses;
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [selectedLensId, setSelectedLensId] = useState("");
  const [study, setStudy] = useState<Study>(() => createDefaultStudy());
  const [dataStatus, setDataStatus] = useState("Chargement des études locales…");
  const [storageReady, setStorageReady] = useState(false);
  const storageSnapshot = useRef<string | null>(null);

  const parsedSensorFormats = useMemo(() => parseSensorFormats(study.sensorFormats), [study.sensorFormats]);
  const filteredCameras = useMemo(
    () =>
      filterCameras(cameras, {
        sensorFormats: parsedSensorFormats,
        fpsMin: study.fpsMin ?? null,
        fpsMax: study.fpsMax ?? null,
        resolutionMpMin: study.resolutionMpMin ?? null,
        resolutionMpMax: study.resolutionMpMax ?? null
      }),
    [cameras, parsedSensorFormats, study.fpsMin, study.fpsMax, study.resolutionMpMin, study.resolutionMpMax]
  );
  const selectedCamera = cameras.find((camera) => camera.id === selectedCameraId);
  const selectedLens = lenses.find((lens) => lens.id === selectedLensId);
  const result = useMemo(
    () => (selectedCamera && selectedLens ? simulateConfiguration(study, selectedCamera, selectedLens) : null),
    [study, selectedCamera, selectedLens]
  );
  const recommendations = useMemo(
    () => rankConfigurations(study, filteredCameras, lenses),
    [study, filteredCameras, lenses]
  );
  useEffect(() => {
    let nextStudies: Study[] = [];
    try {
      storageSnapshot.current = window.localStorage.getItem(STUDIES_KEY);
      nextStudies = storageSnapshot.current === null ? [] : parseStudies(storageSnapshot.current);
      const repaired = nextStudies.map((item) => repairReferences(item, cameras, lenses));
      const changed = JSON.stringify(repaired) !== JSON.stringify(nextStudies);
      nextStudies = repaired;
      setStorageReady(true);
      setDataStatus(changed ? "Certains modèles ont changé : les références des études ont été mises à jour." : "Les études sont enregistrées sur ce navigateur. Exporte-les pour les sauvegarder ou changer d’appareil.");
    } catch {
      setDataStatus("Les études locales sont illisibles ou le stockage est indisponible. Les données existantes sont conservées. Tu peux travailler et exporter ton étude, mais l’enregistrement local est désactivé.");
    }
    const firstStudy = nextStudies[0] ?? repairReferences({ ...createDefaultStudy(), id: crypto.randomUUID() }, cameras, lenses);
    setStudies(nextStudies.length ? nextStudies : [firstStudy]);
    setActiveStudyId(firstStudy.id);
    setStudy(firstStudy);
    setSelectedCameraId(firstStudy.selectedCameraId ?? "");
    setSelectedLensId(firstStudy.selectedLensId ?? "");
  }, [cameras, lenses]);

  function persist(nextStudies: Study[]) {
    if (!storageReady) return false;
    try {
      storageSnapshot.current = writeStudies(window.localStorage, nextStudies, storageSnapshot.current);
      setStudies(nextStudies);
      setDataStatus("Études enregistrées sur ce navigateur. Pense à les exporter pour conserver une sauvegarde.");
      return true;
    } catch (error) {
      setDataStatus(error instanceof Error ? `Enregistrement impossible : ${error.message}` : "Enregistrement impossible. Exporte tes études pour les sauvegarder.");
      return false;
    }
  }

  async function importStudies(file: File) {
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error("Le fichier dépasse 2 Mo.");
      const imported = parseStudies(await file.text()).map((item) => repairReferences(item, cameras, lenses));
      if (!imported.length) throw new Error("Le fichier ne contient aucune étude.");
      const nextStudies = mergeImportedStudies(studies, imported, () => crypto.randomUUID());
      if (!persist(nextStudies)) return;
      const first = nextStudies[0];
      setActiveStudyId(first.id); setStudy(first);
      setSelectedCameraId(first.selectedCameraId ?? ""); setSelectedLensId(first.selectedLensId ?? "");
      setDataStatus(`${imported.length} étude(s) importée(s). Les références absentes du catalogue ont été remplacées.`);
    } catch (error) {
      setDataStatus(error instanceof Error ? `Import impossible : ${error.message}` : "Fichier JSON invalide.");
    }
  }

  function updateStudy<K extends StudyEditableKey>(key: K, value: Study[K]) {
    setStudy((current) => ({
      ...current,
      [key]: value
    }));
  }

  function updateStudyName(value: string) {
    setStudy((current) => ({
      ...current,
      name: value
    }));
  }

  function selectStudy(id: string) {
    const nextStudy = studies.find((item) => item.id === id);
    if (!nextStudy) return;
    const nextSelectedCameraId = resolveExistingId(nextStudy.selectedCameraId, cameras);
    const nextSelectedLensId = resolveExistingId(nextStudy.selectedLensId, lenses);
    setActiveStudyId(id);
    setStudy({
      ...nextStudy,
      sensorFormats: nextStudy.sensorFormats ?? "[]",
      fpsMin: nextStudy.fpsMin ?? null,
      fpsMax: nextStudy.fpsMax ?? null,
      resolutionMpMin: nextStudy.resolutionMpMin ?? null,
      resolutionMpMax: nextStudy.resolutionMpMax ?? null,
      selectedCameraId: nextSelectedCameraId,
      selectedLensId: nextSelectedLensId,
      comparisonPairs: nextStudy.comparisonPairs ?? "[]"
    });
    setSelectedCameraId(nextSelectedCameraId);
    setSelectedLensId(nextSelectedLensId);
  }

  function createStudy() {
    const nextStudy = repairReferences({ ...createDefaultStudy(`Étude ${studies.length + 1}`), id: crypto.randomUUID(), createdAt: new Date().toISOString() }, cameras, lenses);
    if (!persist([nextStudy, ...studies])) return;
    setActiveStudyId(nextStudy.id); setStudy(nextStudy);
    setSelectedCameraId(nextStudy.selectedCameraId ?? ""); setSelectedLensId(nextStudy.selectedLensId ?? "");
  }

  async function saveStudy(comparisonPairs = study.comparisonPairs) {
    const nextStudy = { ...study, id: study.id || crypto.randomUUID(), selectedCameraId, selectedLensId, comparisonPairs, updatedAt: new Date().toISOString() };
    const exists = studies.some((item) => item.id === nextStudy.id);
    const nextStudies = exists ? studies.map((item) => item.id === nextStudy.id ? nextStudy : item) : [nextStudy, ...studies];
    if (!persist(nextStudies)) return false;
    setActiveStudyId(nextStudy.id); setStudy(nextStudy);
    return true;
  }

  function deleteStudy() {
    const remaining = studies.filter((item) => item.id !== study.id);
    if (!persist(remaining)) return;
    const nextStudy = remaining[0] ?? repairReferences({ ...createDefaultStudy(), id: crypto.randomUUID() }, cameras, lenses);
    setActiveStudyId(nextStudy.id); setStudy(nextStudy);
    setSelectedCameraId(nextStudy.selectedCameraId ?? ""); setSelectedLensId(nextStudy.selectedLensId ?? "");
  }

  function selectCamera(id: string) {
    setSelectedCameraId(id);
    setStudy((current) => ({ ...current, selectedCameraId: id }));
  }

  function selectLens(id: string) {
    setSelectedLensId(id);
    setStudy((current) => ({ ...current, selectedLensId: id }));
  }

  function applyRecommendation(cameraId: string, lensId: string) {
    selectCamera(cameraId);
    selectLens(lensId);
  }

  return (
    <div className={cx("app-shell", activeTab === "study" && "has-study-actions")}>
      <a className="skip-link" href="#main">Aller au contenu</a>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="InduVision, accueil">
          <span className="brand-mark" aria-hidden="true"><ScanLine size={32} strokeWidth={1.6} /></span>
          <span className="brand-text">
            <span className="brand-name">InduVision</span>
            <span className="brand-mantra">Outil d'aide pour la Vision</span>
          </span>
        </Link>
        <nav className="site-nav" aria-label="Navigation principale">
          <NavButton icon={<Activity size={17} />} label="Étude" active={activeTab === "study"} onClick={() => setActiveTab("study")} />
          <NavButton icon={<CameraIcon size={17} />} label="Caméras" active={activeTab === "cameras"} onClick={() => setActiveTab("cameras")} />
          <NavButton icon={<Aperture size={17} />} label="Objectifs" active={activeTab === "lenses"} onClick={() => setActiveTab("lenses")} />
          <NavButton icon={<Network size={17} />} label="Réseau GigE" active={activeTab === "network"} onClick={() => setActiveTab("network")} />
        </nav>
        <a className="github-link" href="https://github.com/" target="_blank" rel="noopener noreferrer"><Github size={16} aria-hidden="true" />GitHub</a>
      </header>

      <main id="main" className="page-container" tabIndex={-1}>
        <header className="page-intro">
          <div className="intro-copy">
            <p className={ui.eyebrow}>{activeTab === "study" ? "Outil de dimensionnement en vision industrielle" : activeTab === "network" ? "Dimensionner l’acquisition" : "Le catalogue technique"}</p>
            <h1 className="page-title">
              {activeTab === "study" ? "Choisissez votre caméra et votre objectif" : activeTab === "cameras" ? "Annuaire caméras" : activeTab === "lenses" ? "Annuaire objectifs" : "Calcul réseau GigE"}
            </h1>
            <p className="intro-description">
              {activeTab === "study" ? "Renseignez la zone à observer, la taille des détails à détecter et la distance de prise de vue. Comparez les couples caméra–objectif et vérifiez le champ couvert, la résolution et le flou de mouvement pour votre application." : activeTab === "cameras" ? "Résolution, capteur, cadence : explorez les caractéristiques pour choisir une caméra adaptée à votre application." : activeTab === "lenses" ? "Focale, format et distance de travail : trouvez l’optique qui correspond à votre capteur." : "Estimez le débit de vos caméras et choisissez une liaison réseau adaptée à votre acquisition."}
            </p>
          </div>
          <div className="catalog-metrics" aria-label="Votre espace et le catalogue">
            <Metric label="Études" value={studies.length.toString()} />
            <Metric label="Caméras" value={cameras.length.toString()} />
            <Metric label="Objectifs" value={lenses.length.toString()} />
          </div>
        </header>

        {activeTab === "study" && (
          <section className="study-storage">
            <div className="storage-copy"><span className="storage-icon" aria-hidden="true"><CheckCircle2 size={20} /></span><p className="m-0 text-sm text-muted" role="status">{dataStatus}</p></div>
            <div className="min-w-0">
              <label className="grid gap-1 text-xs font-semibold text-muted">
                Importer des études JSON
                <input className="w-full min-w-0 max-w-full text-xs file:mr-2 file:min-h-10 file:rounded-md file:border file:border-line file:bg-paper file:px-3 file:font-bold" aria-label="Importer des études JSON" type="file" accept="application/json,.json" disabled={!storageReady} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void importStudies(file); }} />
              </label>
            </div>
          </section>
        )}
        {activeTab === "study" && selectedCamera && selectedLens && result && (
          <StudyPanel
            key={study.id}
            cameras={cameras}
            allCameras={cameras}
            lenses={lenses}
            studies={studies}
            activeStudyId={activeStudyId}
            selectStudy={selectStudy}
            createStudy={createStudy}
            saveStudy={saveStudy}
            exportStudy={(comparisonPairs) => downloadStudies([{ ...study, selectedCameraId, selectedLensId, comparisonPairs }])}
            exportAllStudies={(comparisonPairs) => {
              const current = { ...study, selectedCameraId, selectedLensId, comparisonPairs };
              downloadStudies(studies.some((item) => item.id === study.id) ? studies.map((item) => item.id === study.id ? current : item) : [...studies, current]);
            }}
            storageReady={storageReady}
            deleteStudy={deleteStudy}
            selectedCameraId={selectedCameraId}
            selectedLensId={selectedLensId}
            setSelectedCameraId={selectCamera}
            setSelectedLensId={selectLens}
            study={study}
            updateStudy={updateStudy}
            updateStudyName={updateStudyName}
            result={result}
            recommendations={recommendations}
            applyRecommendation={applyRecommendation}
            selectedCamera={selectedCamera}
            selectedLens={selectedLens}
          />
        )}
        {activeTab === "study" && (!selectedCamera || !selectedLens || !result) && (
          <section className={ui.panel}>
            <p className="m-0 font-bold text-ink">
              {!cameras.length
                ? "Aucune caméra disponible."
                : !selectedCamera
                  ? "Aucune caméra ne correspond aux filtres appliqués."
                  : !lenses.length
                    ? "Aucun objectif disponible."
                    : "Sélection incomplète."}
            </p>
            <p className="mt-1 mb-0 text-sm text-muted">{dataStatus}</p>
          </section>
        )}

        {activeTab === "cameras" && <CatalogPanel title="Caméras" items={cameras} />}
        {activeTab === "lenses" && <CatalogPanel title="Objectifs" items={lenses} />}

        {activeTab === "network" && (
          <NetworkPanel cameras={cameras} />
        )}

      </main>
      <footer className="site-footer">
        <a className="provider-link" href="https://yokainco.com/" target="_blank" rel="noopener noreferrer">
          <Image src="/logo-yokai-robotics.png" alt="Logo Yokaï Robotics" width={64} height={64} unoptimized />
          <span>Un outil proposé par <strong>Yokaï Robotics</strong><span className="provider-domain">yokainco.com ↗</span></span>
        </a>
        <span>Vos études restent dans votre navigateur.</span>
      </footer>
    </div>
  );
}

function NavButton(props: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className={cx("nav-button", props.active && "is-active")} aria-current={props.active ? "page" : undefined} onClick={props.onClick}>
      {props.icon}<span>{props.label}</span>
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="catalog-metric"><strong>{value}</strong><span>{label}</span></div>;
}

function NetworkPanel({ cameras }: { cameras: Camera[] }) {
  const [cameraId, setCameraId] = useState("");
  const selectedCamera = cameras.find((camera) => camera.id === cameraId) ?? cameras[0];
  const [width, setWidth] = useState<NumericValue>(0);
  const [height, setHeight] = useState<NumericValue>(0);
  const [fps, setFps] = useState<NumericValue>(0);
  const [bitDepth, setBitDepth] = useState<NumericValue>(8);
  const [cameraCount, setCameraCount] = useState<NumericValue>(1);
  const [overheadPercent, setOverheadPercent] = useState<NumericValue>(20);

  useEffect(() => {
    if (!selectedCamera) return;
    setCameraId(selectedCamera.id);
    setWidth(selectedCamera.resolutionWidth);
    setHeight(selectedCamera.resolutionHeight);
    setFps(selectedCamera.maxFps);
    setBitDepth(parseBitDepth(selectedCamera.bitDepth));
  }, [selectedCamera]);

  const throughput = networkThroughput({ width, height, fps, bitDepth, cameraCount, overheadPercent });
  const links = [
    { label: "1 GigE", capacity: 1000 },
    { label: "2.5 GigE", capacity: 2500 },
    { label: "5 GigE", capacity: 5000 },
    { label: "10 GigE", capacity: 10000 }
  ];

  if (!cameras.length) {
    return (
      <section className={ui.panel}>
        <div className={ui.panelTitle}>
          <Network size={18} />
          <h3>Débit réseau</h3>
        </div>
        <p className="m-0 text-muted">Aucune caméra disponible pour calculer un débit GigE.</p>
      </section>
    );
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,1fr)]">
      <section className={ui.panel}>
        <div className={ui.panelTitle}>
          <Network size={18} />
          <h3>Paramètres flux GigE</h3>
        </div>
        <label className={ui.field}>
          <span className={ui.fieldLabel}>Caméra</span>
          <select className={ui.control} value={cameraId || selectedCamera?.id} onChange={(event) => setCameraId(event.target.value)}>
            {cameras.map((camera) => (
              <option value={camera.id} key={camera.id}>
                {camera.brand} {camera.model}
              </option>
            ))}
          </select>
        </label>
        <div className={ui.formGrid}>
          <NumberField label="Résolution L" unit="px" value={width} onChange={setWidthFromString(setWidth)} />
          <NumberField label="Résolution H" unit="px" value={height} onChange={setWidthFromString(setHeight)} />
          <NumberField label="FPS" unit="fps" value={fps} onChange={setWidthFromString(setFps)} />
          <NumberField label="Bits / pixel" unit="bit" value={bitDepth} onChange={setWidthFromString(setBitDepth)} />
          <NumberField label="Caméras" unit="x" value={cameraCount} onChange={setWidthFromString(setCameraCount)} />
          <NumberField label="Marge protocole" unit="%" value={overheadPercent} description="Marge pour entêtes Ethernet/IP/UDP/GVSP, inter-paquets et réserve réseau." onChange={setWidthFromString(setOverheadPercent)} />
        </div>
      </section>

      <section className={ui.panel}>
        <div className={ui.panelTitle}>
          <Gauge size={18} />
          <h3>Débit nécessaire</h3>
        </div>
        <div className="result-highlight">
          <span className="text-sm text-muted">Débit réseau estimé</span>
          <strong className="mt-1 block text-3xl">{formatNumber(throughput.networkGbps, 2)} Gbit/s</strong>
          <p className="mb-0 mt-2 text-sm text-muted">{formatNumber(throughput.networkMbps)} Mbit/s avec marge de {overheadPercent ?? 0}%</p>
        </div>
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          <Readout icon={<ScanLine size={17} />} label="Pixels / image" value={`${formatNumber(throughput.pixelsPerFrame)} px`} />
          <Readout icon={<Database size={17} />} label="Débit utile" value={`${formatNumber(throughput.usefulMbps)} Mbit/s`} />
          <Readout icon={<Activity size={17} />} label="Flux total" value={`${cameraCount} caméra(s)`} />
          <Readout icon={<CameraIcon size={17} />} label="Format" value={`${width} x ${height} @ ${fps} fps`} />
        </div>
        <div className="mt-4 grid gap-2 border-t border-line pt-4">
          {links.map((link) => {
            const usage = link.capacity > 0 ? (throughput.networkMbps / link.capacity) * 100 : 0;
            const ok = usage <= 80;
            return (
              <div className="grid gap-1" key={link.label}>
                <div className="flex items-center justify-between text-sm">
                  <strong className={ok ? "text-cyan" : "text-accent"}>{link.label}</strong>
                  <span className="text-muted">{formatNumber(usage, 1)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-soft">
                  <span className={cx("block h-full", ok ? "bg-cyan" : "bg-accent")} style={{ width: `${Math.min(100, usage)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function setWidthFromString(setter: (value: NumericValue) => void) {
  return (value: NumericValue) => setter(value);
}

function StudyPanel(props: {
  cameras: Camera[];
  lenses: Lens[];
  studies: Study[];
  activeStudyId: string;
  selectStudy: (id: string) => void;
  createStudy: () => void;
  saveStudy: (comparisonPairs?: string) => Promise<boolean>;
  exportStudy: (comparisonPairs: string) => void;
  exportAllStudies: (comparisonPairs: string) => void;
  storageReady: boolean;
  deleteStudy: () => void;
  allCameras: Camera[];
  selectedCameraId: string;
  selectedLensId: string;
  setSelectedCameraId: (id: string) => void;
  setSelectedLensId: (id: string) => void;
  study: Study;
  updateStudy: <K extends StudyEditableKey>(key: K, value: Study[K]) => void;
  updateStudyName: (value: string) => void;
  result: ReturnType<typeof simulateConfiguration>;
  recommendations: ReturnType<typeof rankConfigurations>;
  applyRecommendation: (cameraId: string, lensId: string) => void;
  selectedCamera: Camera;
  selectedLens: Lens;
}) {
  const { result } = props;
  const [isStudyModalOpen, setIsStudyModalOpen] = useState(false);
  const [isSpecsModalOpen, setIsSpecsModalOpen] = useState(false);
  const [activeComparisonKey, setActiveComparisonKey] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const comparisonKeys = comparisonKeysFromStudy(props.study, props.recommendations);
  const comparisonMatches = comparisonKeys
    .map((key) => resolveMatchKey(key, props.recommendations, props.allCameras, props.lenses, props.study))
    .filter(Boolean) as RankedMatch[];
  const activeComparisonMatch =
    comparisonMatches.find((match) => matchKey(match) === activeComparisonKey) ?? comparisonMatches[0] ?? null;
  const selectedMatch =
    props.recommendations.find((match) => match.camera.id === props.selectedCameraId && match.lens.id === props.selectedLensId) ?? {
      camera: props.selectedCamera,
      lens: props.selectedLens,
      result
    };
  const selectedMatchKey = matchKey(selectedMatch);
  const isSelectedMatchCompared = comparisonKeys.includes(selectedMatchKey);

  useEffect(() => {
    if (!comparisonMatches.length) {
      setActiveComparisonKey("");
      return;
    }
    if (!comparisonMatches.some((match) => matchKey(match) === activeComparisonKey)) {
      setActiveComparisonKey(matchKey(comparisonMatches[0]));
    }
  }, [comparisonMatches, activeComparisonKey]);

  useEffect(() => {
    if (saveStatus !== "saved" && saveStatus !== "error") return;
    const timeout = window.setTimeout(() => setSaveStatus("idle"), 1800);
    return () => window.clearTimeout(timeout);
  }, [saveStatus]);

  const sensorFormatOptions = useMemo(
    () =>
      uniqueStrings(
        props.allCameras.map((camera) => camera.sensorFormat).filter((value): value is string => Boolean(value))
      ),
    [props.allCameras]
  );
  const selectedSensorFormats = useMemo(
    () => parseSensorFormats(props.study.sensorFormats),
    [props.study.sensorFormats]
  );
  const fpsOptions = useMemo(
    () =>
      uniqueNumbers(
        props.allCameras
          .map((camera) => camera.maxFps)
          .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
      ),
    [props.allCameras]
  );
  const resolutionOptions = useMemo(
    () =>
      uniqueNumbers(
        props.allCameras
          .map((camera) => cameraMegapixels(camera))
          .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0)
      ),
    [props.allCameras]
  );

  function addComparisonMatch(match: RankedMatch) {
    const key = matchKey(match);
    if (!comparisonKeys.includes(key)) props.updateStudy("comparisonPairs", serializeComparisonKeys([...comparisonKeys, key]));
  }

  function removeComparisonMatch(key: string) {
    props.updateStudy("comparisonPairs", serializeComparisonKeys(comparisonKeys.filter((item) => item !== key)));
  }

  async function handleSave() {
    setSaveStatus("saving");
    const saved = await props.saveStudy(serializeComparisonKeys(comparisonKeys));
    setSaveStatus(saved ? "saved" : "error");
    return saved;
  }

  return (
    <div className="study-panels grid min-w-0 grid-cols-1 gap-6">
      <section className={ui.panel}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <div className={ui.panelTitle}>
              <Activity size={18} />
              <h3>Étude active</h3>
            </div>
            <label className="grid gap-2">
              <span className={ui.fieldLabel}>Sélection</span>
              <select className={ui.control} value={props.activeStudyId} onChange={(event) => props.selectStudy(event.target.value)}>
                {props.studies.map((study) => (
                  <option value={study.id} key={study.id}>
                    {study.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-[42px_42px] gap-2">
            <button className={ui.iconButton} onClick={props.createStudy} disabled={!props.storageReady} title="Créer une étude">
              <Plus size={16} />
            </button>
            <button className={ui.iconButton} onClick={() => setIsStudyModalOpen(true)} title="Gérer l’étude">
              <Pencil size={16} />
            </button>
          </div>
        </div>
      </section>

      <section className={ui.panel}>
        <div className={ui.panelTitle}>
          <Settings2 size={18} />
          <h3>Paramètres application</h3>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <NumberField label="Champ largeur" unit="mm" description="Largeur réelle de la zone à voir dans l’image." value={props.study.detectionWidthMm} onChange={(value) => props.updateStudy("detectionWidthMm", value)} />
          <NumberField label="Champ hauteur" unit="mm" description="Hauteur réelle de la zone à couvrir." value={props.study.detectionHeightMm} onChange={(value) => props.updateStudy("detectionHeightMm", value)} />
          <NumberField label="Distance travail" unit="mm" description="Distance entre l’objectif et la pièce inspectée." value={props.study.workingDistanceMm} onChange={(value) => props.updateStudy("workingDistanceMm", value)} />
          <NumberField label="Vitesse objet" unit="m/s" description="Vitesse de déplacement de la pièce pendant l’acquisition." value={props.study.objectSpeedMmS} onChange={(value) => props.updateStudy("objectSpeedMmS", value)} />
          <NumberField label="Détail minimal" unit="mm" description="Plus petit défaut ou élément que tu veux détecter." value={props.study.minDetailMm} onChange={(value) => props.updateStudy("minDetailMm", value)} />
          <NumberField label="Pixels par détail" unit="px" description="Nombre de pixels souhaité sur ce détail minimal." value={props.study.pixelsPerDetailTarget} onChange={(value) => props.updateStudy("pixelsPerDetailTarget", value)} />
          <NumberField label="Cadence requise" unit="fps" description="Nombre minimal d’images par seconde nécessaire." value={props.study.requiredFps} onChange={(value) => props.updateStudy("requiredFps", value)} />
          <NumberField label="Exposition" unit="us" description="Temps d’exposition utilisé pour estimer le flou de mouvement." value={props.study.exposureUs} onChange={(value) => props.updateStudy("exposureUs", value)} />
          <NumberField label="Flou max" unit="px" description="Flou de mouvement maximal acceptable en pixels." value={props.study.maxMotionBlurPx} onChange={(value) => props.updateStudy("maxMotionBlurPx", value)} />
          <NumberField label="Largeur objet" unit="cm" description="Largeur réelle de l’objet à projeter sur le capteur." value={props.study.objectWidthCm} onChange={(value) => props.updateStudy("objectWidthCm", value)} />
          <NumberField label="Hauteur objet" unit="cm" description="Hauteur réelle de l’objet à projeter sur le capteur." value={props.study.objectHeightCm} onChange={(value) => props.updateStudy("objectHeightCm", value)} />
          <NumberField label="Longueur objet" unit="cm" description="Longueur réelle de l’objet à projeter sur le capteur." value={props.study.objectLengthCm} onChange={(value) => props.updateStudy("objectLengthCm", value)} />
          <label className="grid gap-2">
            <span className={ui.fieldLabel}>Axe déplacement</span>
            <select
              className={ui.control}
              value={props.study.objectTravelAxis}
              onChange={(event) => props.updateStudy("objectTravelAxis", event.target.value as Study["objectTravelAxis"])}
            >
              <option value="horizontal">Horizontal</option>
              <option value="vertical">Vertical</option>
            </select>
            <span className="text-xs text-muted">
              Sélectionne l’axe réel du convoyeur pour utiliser la bonne dimension du champ couvert dans le calcul.
            </span>
          </label>
        </div>
        <div className="mt-5 border-t border-line pt-4">
          <div className="mb-3 flex items-center gap-2 text-cyan">
            <SlidersHorizontal size={18} />
            <h4 className="m-0 text-base font-bold text-ink">Filtres caméra</h4>
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_repeat(4,minmax(0,1fr))]">
            <label className="grid gap-2 text-xs font-bold uppercase tracking-normal text-muted">
              <span>Format capteur</span>
              <select
                className={cx(ui.control, "min-h-[148px] py-2")}
                multiple
                size={Math.min(6, Math.max(3, sensorFormatOptions.length || 3))}
                value={selectedSensorFormats}
                onChange={(event) => {
                  const values = Array.from(event.currentTarget.selectedOptions, (option) => option.value);
                  props.updateStudy("sensorFormats", serializeSensorFormats(values));
                }}
              >
                {sensorFormatOptions.map((format) => (
                  <option value={format} key={format}>
                    {format}
                  </option>
                ))}
              </select>
            </label>
            <SelectFilter
              label="FPS min"
              value={props.study.fpsMin ?? null}
              options={fpsOptions}
              digits={0}
              onChange={(value) => props.updateStudy("fpsMin", value)}
            />
            <SelectFilter
              label="FPS max"
              value={props.study.fpsMax ?? null}
              options={fpsOptions}
              digits={0}
              onChange={(value) => props.updateStudy("fpsMax", value)}
            />
            <SelectFilter
              label="Résolution min"
              suffix="MP"
              value={props.study.resolutionMpMin ?? null}
              options={resolutionOptions}
              digits={1}
              onChange={(value) => props.updateStudy("resolutionMpMin", value)}
            />
            <SelectFilter
              label="Résolution max"
              suffix="MP"
              value={props.study.resolutionMpMax ?? null}
              options={resolutionOptions}
              digits={1}
              onChange={(value) => props.updateStudy("resolutionMpMax", value)}
            />
          </div>
          <p className="m-0 mt-3 text-xs leading-5 text-muted">
            La résolution est calculée à partir de `largeur x hauteur` du capteur.
          </p>
        </div>
      </section>

      <section className={ui.panel}>
        <div className={ui.panelTitle}>
          <CheckCircle2 size={18} />
          <h3>Meilleurs matchs caméra + objectif</h3>
        </div>
        <div className="grid gap-2.5 xl:grid-cols-4">
          {props.recommendations.slice(0, 4).map((match, index) => (
            <button
              type="button"
              className={cx(
                "grid min-h-[142px] gap-2 rounded-md border p-3 text-left transition-colors",
                match.camera.id === props.selectedCameraId && match.lens.id === props.selectedLensId
                  ? "border-cyan bg-cyan/10"
                  : "border-line bg-paper hover:border-cyan hover:bg-cyan/5"
              )}
              key={`${match.camera.id}-${match.lens.id}`}
              onClick={() => props.applyRecommendation(match.camera.id, match.lens.id)}
            >
              <div>
                <p className="m-0 text-xs font-semibold uppercase tracking-wide text-muted">#{index + 1} · Score {match.result.score}%</p>
                <strong className="block break-words text-ink">{match.camera.brand} {match.camera.model}</strong>
                <span className="text-sm text-muted">{match.lens.brand} {match.lens.model} · {match.lens.focalLengthMm} mm</span>
              </div>
              <div className="grid gap-1 text-xs text-ink">
                <span>{formatNumber(match.result.coveredWidthMm)} x {formatNumber(match.result.coveredHeightMm)} mm</span>
                <span>{formatNumber(match.result.mmPerPixel, 4)} mm/px</span>
                <span>Flou {formatNumber(match.result.motionBlurPixels)} px</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className={ui.panel}>
        <div className={ui.panelTitle}>
          <Gauge size={18} />
          <h3>Sélection</h3>
        </div>
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="grid gap-2 text-xs font-bold uppercase tracking-normal text-muted">
            <span>Caméra sélectionnée</span>
            <select className={ui.control} value={props.selectedCameraId} onChange={(event) => props.setSelectedCameraId(event.target.value)}>
              {props.cameras.map((camera) => (
                <option value={camera.id} key={camera.id}>
                  {camera.brand} {camera.model}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-xs font-bold uppercase tracking-normal text-muted">
            <span>Objectif sélectionné</span>
            <select className={ui.control} value={props.selectedLensId} onChange={(event) => props.setSelectedLensId(event.target.value)}>
              {props.lenses.map((lens) => (
                <option value={lens.id} key={lens.id}>
                  {lens.brand} {lens.model} - {lens.focalLengthMm} mm
                </option>
              ))}
            </select>
          </label>
          <div className="md:col-span-2">
            <button
              type="button"
              className="min-h-10 rounded-md border border-line bg-white px-4 text-sm font-bold text-cyan hover:border-cyan"
              onClick={() => setIsSpecsModalOpen(true)}
            >
              Voir caractéristiques caméra + objectif
            </button>
          </div>
        </div>
        <div className="result-highlight">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted">Compatibilité</span>
            <strong className="text-3xl">{result.score}%</strong>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-cyan/10">
            <span className="block h-full bg-cyan" style={{ width: `${result.score}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
          <Readout icon={<Ruler size={17} />} label="Focale théorique" value={`${formatNumber(result.requiredFocalLengthMm)} mm`} />
          <Readout icon={<ScanLine size={17} />} label="Champ couvert" value={`${formatNumber(result.coveredWidthMm)} x ${formatNumber(result.coveredHeightMm)} mm`} />
          <Readout icon={<Database size={17} />} label="Taille réelle d'un pixel" value={`${formatNumber(result.mmPerPixel, 4)} mm/px`} />
          <Readout icon={<Activity size={17} />} label="Détail" value={`${formatNumber(result.pixelsOnDetail)} px`} />
          <Readout icon={<Gauge size={17} />} label="Flou mouvement" value={`${formatNumber(result.motionBlurPixels)} px`} />
          <Readout icon={<Aperture size={17} />} label="Diagonale capteur" value={`${formatNumber(result.sensorDiagonalMm)} mm`} />
          <Readout icon={<ScanLine size={17} />} label="Angle horizontal" value={`${formatNumber(result.horizontalFovDeg)} °`} />
          <Readout icon={<Ruler size={17} />} label="Angle vertical" value={`${formatNumber(result.verticalFovDeg)} °`} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            ["Champ", result.fieldCompatible],
            ["Détail", result.detailCompatible],
            ["Cadence", result.fpsCompatible],
            ["Flou", result.blurCompatible],
            ["Monture", result.mountCompatible],
            ["Capteur", result.sensorCompatible],
            ["Focus", result.focusCompatible]
          ].map(([label, ok]) => (
            <span
              className={cx(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-bold",
                ok ? "bg-cyan/10 text-cyan" : "bg-accent/15 text-accent"
              )}
              key={label as string}
            >
              {ok ? <CheckCircle2 size={14} /> : <TriangleAlert size={14} />}
              {label as string}
            </span>
          ))}
        </div>
        <div className="mt-4 grid gap-3 border-t border-line pt-4 md:grid-cols-2">
          <SelectedCameraCard camera={props.selectedCamera} />
          <SelectedLensCard lens={props.selectedLens} />
        </div>
        <div className="mt-4 border-t border-line pt-4">
          <button
            type="button"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-accent bg-accent px-4 text-sm font-bold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-45"
            disabled={isSelectedMatchCompared}
            onClick={() => addComparisonMatch(selectedMatch)}
          >
            {isSelectedMatchCompared ? <CheckCircle2 size={16} /> : <Plus size={16} />}
            {isSelectedMatchCompared ? "Couple déjà dans la comparaison" : "Ajouter ce couple à la comparaison"}
          </button>
        </div>
        {result.issues.length > 0 && (
          <div className="mt-3 rounded-md border border-accent/25 bg-accent/10 p-3 text-accent-hover">
            {result.issues.map((issue) => (
              <p className="mb-1 last:mb-0" key={issue}>{issue}</p>
            ))}
          </div>
        )}
      </section>

      <MatchComparisonCard
        comparisonMatches={comparisonMatches}
        activeComparisonMatch={activeComparisonMatch}
        activeComparisonKey={activeComparisonKey}
        setActiveComparisonKey={setActiveComparisonKey}
        study={props.study}
        onRemove={removeComparisonMatch}
      />

      {isStudyModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4">
          <section className="w-full max-w-lg rounded-panel border border-line bg-white p-5 shadow-panel">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="mb-1 text-xs font-bold uppercase text-muted">Gestion étude</p>
                <h3 className="m-0 text-lg font-bold text-ink">{props.study.name}</h3>
              </div>
              <button className={ui.iconButton} onClick={() => setIsStudyModalOpen(false)} title="Fermer">
                ×
              </button>
            </div>

            <TextField label="Nom de l’étude" value={props.study.name} onChange={props.updateStudyName} />

            <div className="mt-5 grid gap-2 border-t border-line pt-4 sm:grid-cols-[minmax(0,1fr)_auto]">
              <button
                className={ui.primaryButton}
                onClick={async () => {
                  const saved = await handleSave();
                  if (saved) setIsStudyModalOpen(false);
                }}
              >
                Enregistrer les modifications
              </button>
              <button
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-red-300 bg-white px-4 font-bold text-red-600 hover:border-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!props.study.id || !props.storageReady}
                onClick={() => {
                  props.deleteStudy();
                  setIsStudyModalOpen(false);
                }}
              >
                <Trash2 size={16} />
                Supprimer
              </button>
            </div>
          </section>
        </div>
      )}

      {isSpecsModalOpen && (
        <SpecsModal
          camera={props.selectedCamera}
          lens={props.selectedLens}
          onClose={() => setIsSpecsModalOpen(false)}
        />
      )}

      <div className="study-actions">
        <div className="study-actions-inner">
          <button type="button" className="cta cta-secondary" onClick={() => props.exportAllStudies(serializeComparisonKeys(comparisonKeys))}>Exporter toutes les études</button>
          <button type="button" className="cta cta-secondary" onClick={() => props.exportStudy(serializeComparisonKeys(comparisonKeys))}>Exporter cette étude</button>
          <div className="save-action">
            <button
              type="button"
              className={cx(
                "cta cta-primary relative w-full gap-2 overflow-hidden sm:w-auto sm:min-w-[270px]",
                saveStatus === "saved"
                  ? "border-cyan bg-cyan hover:bg-cyan"
                  : "border-accent bg-accent hover:bg-accent-hover",
                saveStatus === "saving" && "cursor-wait opacity-70"
              )}
              disabled={saveStatus === "saving" || !props.storageReady}
              onClick={handleSave}
            >
              <span
                className={cx(
                  "flex items-center justify-center gap-2 whitespace-nowrap transition-opacity duration-300",
                  saveStatus === "saved" ? "opacity-0" : "opacity-100"
                )}
              >
                {saveStatus === "saving" ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <CheckCircle2 size={17} />}
                {saveStatus === "saving" ? "Enregistrement..." : "Enregistrer sur ce navigateur"}
              </span>
              <span
                className={cx(
                  "absolute inset-0 flex items-center justify-center gap-2 whitespace-nowrap transition-opacity duration-300",
                  saveStatus === "saved" ? "opacity-100" : "opacity-0"
                )}
              >
                <CheckCircle2 size={17} />
                Étude enregistrée
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MatchComparisonCard(props: {
  comparisonMatches: RankedMatch[];
  activeComparisonMatch: RankedMatch | null;
  activeComparisonKey: string;
  setActiveComparisonKey: (value: string) => void;
  study: Study;
  onRemove: (key: string) => void;
}) {
  return (
    <section className={ui.panel}>
      <div className={ui.panelTitle}>
        <Gauge size={18} />
        <h3>Comparaison technique</h3>
      </div>

      {props.comparisonMatches.length > 0 && (
        <div className="mb-4 grid grid-cols-1 gap-3">
          <label className="grid gap-2 text-xs font-bold uppercase tracking-normal text-muted">
            <span>Couple affiché</span>
            <select
              className={ui.control}
              value={props.activeComparisonKey || (props.comparisonMatches[0] ? matchKey(props.comparisonMatches[0]) : "")}
              onChange={(event) => props.setActiveComparisonKey(event.target.value)}
            >
              {props.comparisonMatches.map((match) => (
                <option value={matchKey(match)} key={matchKey(match)}>
                  {match.camera.brand} {match.camera.model} + {match.lens.brand} {match.lens.model}
                </option>
              ))}
            </select>
          </label>
          <ObjectSizeChart match={props.activeComparisonMatch} study={props.study} />
        </div>
      )}

      {props.comparisonMatches.length > 0 ? (
        <ComparisonTable matches={props.comparisonMatches} study={props.study} onRemove={props.onRemove} />
      ) : (
        <div className="rounded-panel border border-line bg-paper p-4">
          <p className="m-0 font-bold text-ink">Aucun couple sélectionné</p>
          <p className="mt-1 mb-0 text-sm text-muted">Ajoute le couple sélectionné depuis la card de résultat technique.</p>
        </div>
      )}
    </section>
  );
}

function ObjectSizeChart({ match, study }: { match: RankedMatch | null; study: Study }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [chartMaxDistanceM, setChartMaxDistanceM] = useState(20);
  const widthCm = positiveNumber(study.objectWidthCm);
  const heightCm = positiveNumber(study.objectHeightCm);
  const lengthCm = positiveNumber(study.objectLengthCm);

  if (!match || (widthCm <= 0 && heightCm <= 0 && lengthCm <= 0)) {
    return (
      <div className="rounded-panel border border-line bg-paper p-4">
        <p className="m-0 font-bold text-ink">Graphique taille pixel</p>
        <p className="mt-1 mb-0 text-sm text-muted">
          Renseigne les dimensions de l’objet pour afficher les 3 courbes.
        </p>
      </div>
    );
  }

  const series = [
    {
      label: "Largeur",
      color: "#168ba0",
      dimensionMm: widthCm * 10
    },
    {
      label: "Hauteur",
      color: "#e95420",
      dimensionMm: heightCm * 10
    },
    {
      label: "Longueur",
      color: "#43565c",
      dimensionMm: lengthCm * 10
    }
  ].filter((item) => item.dimensionMm > 0);

  const chartMinDistanceMm = positiveNumber(match.lens.minWorkingDistanceMm || match.lens.minFocusDistanceMm || 0);
  const chartMaxDistanceMm = Math.max(chartMinDistanceMm, chartMaxDistanceM * 1_000);
  const sampleCount = 80;
  const distancesMm = Array.from({ length: sampleCount }, (_, index) => {
    const ratio = index / (sampleCount - 1);
    return chartMinDistanceMm + ratio * (chartMaxDistanceMm - chartMinDistanceMm);
  });
  const points = series.map((item) => ({
    ...item,
    values: distancesMm.map((distanceMm) => ({
      distanceMm,
      pixels: objectPixelsAtDistance(match.camera, match.lens, item.dimensionMm, distanceMm)
    }))
  }));
  const maxPixels = Math.max(...points.flatMap((item) => item.values.map((value) => value.pixels)), 1);
  const minPixels = 0;
  const viewWidth = 820;
  const viewHeight = 280;
  const paddingLeft = 58;
  const paddingRight = 18;
  const paddingTop = 18;
  const paddingBottom = 40;
  const plotWidth = viewWidth - paddingLeft - paddingRight;
  const plotHeight = viewHeight - paddingTop - paddingBottom;
  const tickCount = 5;
  const distanceTicksMm = Array.from({ length: tickCount }, (_, index) => {
    const ratio = index / (tickCount - 1);
    return chartMinDistanceMm + ratio * (chartMaxDistanceMm - chartMinDistanceMm);
  });
  const yTicks = [0, maxPixels * 0.25, maxPixels * 0.5, maxPixels * 0.75, maxPixels];
  const hoveredPoint =
    hoveredIndex === null
      ? null
      : {
        distanceMm: distancesMm[hoveredIndex],
        values: points.map((item) => ({
          label: item.label,
          color: item.color,
          pixels: item.values[hoveredIndex]?.pixels ?? 0
        }))
      };

  function xFor(distanceMm: number) {
    return paddingLeft + ((distanceMm - chartMinDistanceMm) / (chartMaxDistanceMm - chartMinDistanceMm)) * plotWidth;
  }

  function yFor(pixels: number) {
    return paddingTop + plotHeight - ((pixels - minPixels) / (maxPixels - minPixels || 1)) * plotHeight;
  }

  function pathFor(values: { distanceMm: number; pixels: number }[]) {
    return values
      .map((point, index) => `${index === 0 ? "M" : "L"} ${xFor(point.distanceMm).toFixed(2)} ${yFor(point.pixels).toFixed(2)}`)
      .join(" ");
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const svg = event.currentTarget;
    const bounds = svg.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const clampedX = Math.min(Math.max(x, paddingLeft), viewWidth - paddingRight);
    const ratio = (clampedX - paddingLeft) / (plotWidth || 1);
    const distanceMm = chartMinDistanceMm + ratio * (chartMaxDistanceMm - chartMinDistanceMm);
    const nearestIndex = Math.min(
      distancesMm.length - 1,
      Math.max(
        0,
        distancesMm.findIndex((value) => value >= distanceMm)
      )
    );
    const resolvedIndex = nearestIndex <= 0 ? 0 : nearestIndex;
    setHoveredIndex(resolvedIndex);
  }

  return (
    <div className="rounded-panel border border-line bg-paper p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="m-0 text-xs font-bold uppercase text-muted">Taille en pixels selon la distance</p>
          <p className="m-0 text-sm text-muted">
            Courbes de {formatNumber(chartMinDistanceMm / 1000, 1)} à {formatNumber(chartMaxDistanceM, 0)} m pour le couple sélectionné.
          </p>
        </div>
        <div className="grid min-w-[260px] gap-2">
          <label className="grid gap-1.5 text-xs font-bold uppercase tracking-normal text-muted">
            <span>Distance max visualisée: {formatNumber(chartMaxDistanceM, 0)} m</span>
            <input
              className="w-full accent-cyan"
              max={20}
              min={2}
              step={1}
              type="range"
              value={chartMaxDistanceM}
              onChange={(event) => setChartMaxDistanceM(Number(event.target.value))}
            />
          </label>
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            {points.map((item) => (
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-ink" key={item.label}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                {item.label} {formatNumber(item.dimensionMm / 10)} cm
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-md border border-line bg-white">
        <svg
          className="block h-auto w-full"
          viewBox={`0 0 ${viewWidth} ${viewHeight}`}
          role="img"
          aria-label="Graphique taille pixel selon la distance"
          onPointerLeave={() => setHoveredIndex(null)}
          onPointerMove={handlePointerMove}
        >
          <defs>
            <linearGradient id="chart-grid" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#dfe5e5" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#dfe5e5" stopOpacity="0" />
            </linearGradient>
          </defs>
          {distanceTicksMm.map((tick) => (
            <g key={tick}>
              <line
                x1={xFor(tick)}
                x2={xFor(tick)}
                y1={paddingTop}
                y2={paddingTop + plotHeight}
                stroke="url(#chart-grid)"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={xFor(tick)}
                y={viewHeight - 14}
                fill="#607076"
                fontSize="11"
                textAnchor={tick === chartMinDistanceMm ? "start" : "middle"}
              >
                {formatNumber(tick / 1000, 1)} m
              </text>
            </g>
          ))}
          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={paddingLeft}
                x2={viewWidth - paddingRight}
                y1={yFor(tick)}
                y2={yFor(tick)}
                stroke="#dfe5e5"
                strokeWidth="1"
              />
              <text x={paddingLeft - 8} y={yFor(tick) + 4} fill="#607076" fontSize="11" textAnchor="end">
                {formatNumber(tick, 0)}
              </text>
            </g>
          ))}
          {points.map((item) => (
            <path
              d={pathFor(item.values)}
              fill="none"
              key={item.label}
              stroke={item.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          <line x1={paddingLeft} x2={paddingLeft} y1={paddingTop} y2={paddingTop + plotHeight} stroke="#c9d3d5" strokeWidth="1.2" />
          <line x1={paddingLeft} x2={viewWidth - paddingRight} y1={paddingTop + plotHeight} y2={paddingTop + plotHeight} stroke="#c9d3d5" strokeWidth="1.2" />
          {hoveredPoint && (
            <>
              <line
                x1={xFor(hoveredPoint.distanceMm)}
                x2={xFor(hoveredPoint.distanceMm)}
                y1={paddingTop}
                y2={paddingTop + plotHeight}
                stroke="#9aabad"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              {hoveredPoint.values.map((item) => (
                <circle
                  cx={xFor(hoveredPoint.distanceMm)}
                  cy={yFor(item.pixels)}
                  fill="#fff"
                  key={item.label}
                  r="4"
                  stroke={item.color}
                  strokeWidth="2"
                />
              ))}
            </>
          )}
        </svg>
        {hoveredPoint && (
          <div
            className="pointer-events-none absolute rounded-md border border-line bg-white px-3 py-2 text-xs shadow-panel"
            style={{
              left: Math.min(viewWidth - 220, Math.max(12, xFor(hoveredPoint.distanceMm) + 12)),
              top: 16
            }}
          >
            <p className="m-0 font-bold text-ink">{formatNumber(hoveredPoint.distanceMm / 1000, 2)} m</p>
            <div className="mt-1 grid gap-1 text-ink">
              {hoveredPoint.values.map((item) => (
                <div className="flex items-center justify-between gap-3" key={item.label}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.label}
                  </span>
                  <strong className="text-ink">{formatNumber(item.pixels, 1)} px</strong>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ComparisonTable({
  matches,
  study,
  onRemove
}: {
  matches: RankedMatch[];
  study: Study;
  onRemove: (key: string) => void;
}) {
  const rows = comparisonRows(matches, study);

  return (
    <div className="overflow-x-auto rounded-panel border border-line">
      <table className="min-w-full border-collapse bg-white text-sm">
        <thead>
          <tr className="bg-soft text-left text-ink">
            <th className="sticky left-0 z-10 min-w-[190px] bg-soft px-3 py-3 font-bold">Caractéristique</th>
            {matches.map((match, index) => (
              <th className="min-w-[220px] px-3 py-3 align-top font-bold" key={matchKey(match)}>
                <div className="grid gap-2">
                  <span>Couple {index + 1}</span>
                  <span className="text-xs font-normal text-muted">
                    {match.camera.brand} {match.camera.model}
                    <br />
                    {match.lens.brand} {match.lens.model}
                  </span>
                  <button
                    type="button"
                    className="inline-flex min-h-8 w-fit items-center gap-1.5 rounded-md border border-line bg-white px-3 text-xs font-semibold text-cyan hover:bg-cyan/10"
                    onClick={() => onRemove(matchKey(match))}
                  >
                    <X size={13} />
                    Retirer
                  </button>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-t border-line" key={row.label}>
              <th className="sticky left-0 z-10 bg-paper px-3 py-2 text-left text-xs font-bold uppercase text-muted">
                {row.label}
              </th>
              {row.values.map((value, index) => (
                <td className="px-3 py-2 text-ink" key={`${row.label}-${index}`}>
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function matchKey(match: RankedMatch) {
  return `${match.camera.id}::${match.lens.id}`;
}

function comparisonRows(matches: RankedMatch[], study: Study) {
  const workingDistanceMm = positiveNumber(study.workingDistanceMm);
  const objectDimensions = [
    { label: "Largeur", value: positiveNumber(study.objectWidthCm) * 10 },
    { label: "Hauteur", value: positiveNumber(study.objectHeightCm) * 10 },
    { label: "Longueur", value: positiveNumber(study.objectLengthCm) * 10 }
  ].filter((item) => item.value > 0);
  const travelAxisLabel = study.objectTravelAxis === "vertical" ? "Vertical" : "Horizontal";

  function objectPixelsLabel(match: RankedMatch) {
    if (workingDistanceMm <= 0 || objectDimensions.length === 0) return "Non renseigné";
    return objectDimensions
      .map((item) => `${item.label} ${formatNumber(objectPixelsAtDistance(match.camera, match.lens, item.value, workingDistanceMm), 0)} px`)
      .join(" · ");
  }

  function coverageBadge(status: RankedMatch["result"]["objectCoverageStatus"]) {
    const className =
      status === "Risque de détection insuffisante"
        ? "bg-accent/15 text-accent"
        : status === "Acquisition acceptable"
          ? "bg-cyan/10 text-cyan"
          : "bg-sky-600/10 text-sky-700";

    return (
      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-bold ${className}`}>
        {status}
      </span>
    );
  }

  return [
    {
      label: "Score",
      values: matches.map((match) => `${match.result.score}%`)
    },
    {
      label: "Caméra",
      values: matches.map((match) => `${match.camera.brand} ${match.camera.model}`)
    },
    {
      label: "Objectif",
      values: matches.map((match) => `${match.lens.brand} ${match.lens.model}`)
    },
    {
      label: "Focale objectif",
      values: matches.map((match) => `${formatNumber(match.lens.focalLengthMm)} mm`)
    },
    {
      label: "Focale théorique",
      values: matches.map((match) => `${formatNumber(match.result.requiredFocalLengthMm)} mm`)
    },
    {
      label: "Champ couvert",
      values: matches.map((match) => `${formatNumber(match.result.coveredWidthMm)} x ${formatNumber(match.result.coveredHeightMm)} mm`)
    },
    {
      label: "Résolution caméra",
      values: matches.map((match) => `${match.camera.resolutionWidth} x ${match.camera.resolutionHeight} px`)
    },
    {
      label: "Taille pixel réelle",
      values: matches.map((match) => `${formatNumber(match.result.mmPerPixel, 4)} mm/px`)
    },
    {
      label: "Taille max objet",
      values: matches.map((match) =>
        match.result.objectMaxDimensionMm > 0 ? `${formatNumber(match.result.objectMaxDimensionMm)} mm` : "Non renseigné"
      )
    },
    {
      label: "Axe déplacement",
      values: matches.map(() => travelAxisLabel)
    },
    {
      label: "Champ de vision utilisé",
      values: matches.map((match) =>
        match.result.objectFieldOfViewMm > 0 ? `${formatNumber(match.result.objectFieldOfViewMm)} mm` : "Non renseigné"
      )
    },
    {
      label: "Temps visibilité objet",
      values: matches.map((match) =>
        match.result.objectVisibilityTimeS > 0 ? `${formatNumber(match.result.objectVisibilityTimeS, 2)} s` : "0,00 s"
      )
    },
    {
      label: "Images théoriques",
      values: matches.map((match) =>
        match.result.objectFrameCount > 0 ? `${formatNumber(match.result.objectFrameCount, 2)}` : "0,00"
      )
    },
    {
      label: "Images arrondies",
      values: matches.map((match) => `${match.result.objectRoundedFrameCount}`)
    },
    {
      label: "Couverture",
      values: matches.map((match) => coverageBadge(match.result.objectCoverageStatus))
    },
    {
      label: "Taille objet à la distance de travail",
      values: matches.map((match) => objectPixelsLabel(match))
    },
    {
      label: "Pixels sur détail",
      values: matches.map((match) => `${formatNumber(match.result.pixelsOnDetail)} px`)
    },
    {
      label: "Cadence max",
      values: matches.map((match) => `${formatNumber(match.camera.maxFps)} fps`)
    },
    {
      label: "Flou mouvement",
      values: matches.map((match) => `${formatNumber(match.result.motionBlurPixels)} px`)
    },
    {
      label: "Diagonale capteur",
      values: matches.map((match) => `${formatNumber(match.result.sensorDiagonalMm)} mm`)
    },
    {
      label: "Format capteur",
      values: matches.map((match) => `${match.camera.sensorFormat || "Non renseigné"} / ${match.lens.sensorFormat || "Non renseigné"}`)
    },
    {
      label: "Monture",
      values: matches.map((match) => `${match.camera.lensMount || "Non renseigné"} / ${match.lens.mount || "Non renseigné"}`)
    },
    {
      label: "Distance focus min",
      values: matches.map((match) => `${formatNumber(match.lens.minWorkingDistanceMm || match.lens.minFocusDistanceMm)} mm`)
    },
    {
      label: "Angle horizontal",
      values: matches.map((match) => `${formatNumber(match.result.horizontalFovDeg)} deg`)
    },
    {
      label: "Angle vertical",
      values: matches.map((match) => `${formatNumber(match.result.verticalFovDeg)} deg`)
    },
    {
      label: "Compatibilités",
      values: matches.map((match) => <CompatibilityBadges match={match} key={matchKey(match)} />)
    },
    {
      label: "Points d'attention",
      values: matches.map((match) => match.result.issues.length > 0 ? match.result.issues.join(" ") : "Aucun")
    }
  ];
}

function CompatibilityBadges({ match }: { match: RankedMatch }) {
  const checks = [
    ["Champ", match.result.fieldCompatible],
    ["Détail", match.result.detailCompatible],
    ["Cadence", match.result.fpsCompatible],
    ["Flou", match.result.blurCompatible],
    ["Monture", match.result.mountCompatible],
    ["Capteur", match.result.sensorCompatible],
    ["Focus", match.result.focusCompatible]
  ];

  return (
    <div className="flex flex-wrap gap-1.5">
      {checks.map(([label, ok]) => (
        <span
          className={cx(
            "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold",
            ok ? "bg-cyan/10 text-cyan" : "bg-accent/15 text-accent"
          )}
          key={label as string}
        >
          {ok ? <CheckCircle2 size={14} /> : <TriangleAlert size={14} />}
          {label as string}
        </span>
      ))}
    </div>
  );
}

function SelectedCameraCard({ camera }: { camera: Camera }) {
  return (
    <article className="rounded-panel border border-line bg-paper p-4">
      <div className="mb-3 flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-cyan/10 text-cyan">
          <CameraIcon size={18} />
        </span>
        <div className="min-w-0">
          <p className="m-0 text-xs font-bold uppercase text-muted">Caméra sélectionnée</p>
          <h4 className="m-0 break-words text-base font-bold text-ink">
            {camera.brand} {camera.model}
          </h4>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <SelectedSpec label="Résolution" value={`${camera.resolutionWidth} x ${camera.resolutionHeight} px`} />
        <SelectedSpec label="Cadence" value={`${formatNumber(camera.maxFps)} fps`} />
        <SelectedSpec label="Capteur" value={`${formatNumber(camera.sensorWidthMm)} x ${formatNumber(camera.sensorHeightMm)} mm`} />
        <SelectedSpec label="Pixel" value={`${formatNumber(camera.pixelSizeUm)} um`} />
        <SelectedSpec label="Format" value={camera.sensorFormat} />
        <SelectedSpec label="Monture" value={camera.lensMount} />
      </div>
    </article>
  );
}

function SelectedLensCard({ lens }: { lens: Lens }) {
  return (
    <article className="rounded-panel border border-line bg-paper p-4">
      <div className="mb-3 flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-cyan/10 text-cyan">
          <Aperture size={18} />
        </span>
        <div className="min-w-0">
          <p className="m-0 text-xs font-bold uppercase text-muted">Objectif sélectionné</p>
          <h4 className="m-0 break-words text-base font-bold text-ink">
            {lens.brand} {lens.model}
          </h4>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <SelectedSpec label="Focale" value={`${formatNumber(lens.focalLengthMm)} mm`} />
        <SelectedSpec label="Type" value={lens.lensType} />
        <SelectedSpec label="Monture" value={lens.mount} />
        <SelectedSpec label="Format" value={lens.sensorFormat} />
        <SelectedSpec label="Diagonale max" value={`${formatNumber(lens.maxSensorDiagonalMm)} mm`} />
        <SelectedSpec label="Focus min" value={`${formatNumber(lens.minWorkingDistanceMm || lens.minFocusDistanceMm)} mm`} />
      </div>
    </article>
  );
}

function SelectedSpec({ label, value }: { label: string; value?: string }) {
  return (
    <div className="min-h-[58px] rounded-md border border-line bg-white p-2">
      <span className="block text-[11px] font-bold uppercase text-muted">{label}</span>
      <strong className="mt-1 block break-words text-xs text-ink">
        {value && value.trim() ? value : "Non renseigné"}
      </strong>
    </div>
  );
}

function SpecsModal({ camera, lens, onClose }: { camera: Camera; lens: Lens; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4">
      <section className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-panel border border-line bg-white p-5 shadow-panel">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-bold uppercase text-muted">Configuration sélectionnée</p>
            <h3 className="m-0 text-lg font-bold text-ink">Caractéristiques caméra + objectif</h3>
          </div>
          <button className={ui.iconButton} type="button" onClick={onClose} title="Fermer">
            ×
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-panel border border-line bg-paper p-4">
            <div className="mb-4 flex items-center gap-2 text-cyan">
              <CameraIcon size={18} />
              <h4 className="m-0 text-base font-bold text-ink">Caméra</h4>
            </div>
            <SpecHeader brand={camera.brand} model={camera.model} />
            <div className="mt-4 grid gap-2">
              <SpecRow label="Type" value={camera.cameraType} />
              <SpecRow label="Capteur" value={`${camera.sensorSupplier} ${camera.sensorModel}`.trim()} />
              <SpecRow label="Technologie" value={camera.sensorTechnology} />
              <SpecRow label="Mono / couleur" value={camera.colorMode} />
              <SpecRow label="Format capteur" value={camera.sensorFormat} />
              <SpecRow label="Résolution" value={`${camera.resolutionWidth} x ${camera.resolutionHeight} px`} />
              <SpecRow label="Taille capteur" value={`${formatNumber(camera.sensorWidthMm)} x ${formatNumber(camera.sensorHeightMm)} mm`} />
              <SpecRow label="Pixel" value={`${formatNumber(camera.pixelSizeUm)} um`} />
              <SpecRow label="FPS max" value={`${formatNumber(camera.maxFps)} fps`} />
              <SpecRow label="Interface" value={camera.interfaceType} />
              <SpecRow label="Obturateur" value={camera.shutter} />
              <SpecRow label="Monture" value={camera.lensMount} />
              <SpecRow label="Bits" value={camera.bitDepth} />
              <SpecRow label="Exposition" value={camera.exposureRange} />
              <SpecRow label="URL" value={camera.sourceUrl} />
            </div>
          </section>

          <section className="rounded-panel border border-line bg-paper p-4">
            <div className="mb-4 flex items-center gap-2 text-cyan">
              <Aperture size={18} />
              <h4 className="m-0 text-base font-bold text-ink">Objectif</h4>
            </div>
            <SpecHeader brand={lens.brand} model={lens.model} />
            <div className="mt-4 grid gap-2">
              <SpecRow label="Focale" value={`${formatNumber(lens.focalLengthMm)} mm`} />
              <SpecRow label="Monture" value={lens.mount} />
              <SpecRow label="Format capteur" value={lens.sensorFormat} />
              <SpecRow label="Diagonale max" value={`${formatNumber(lens.maxSensorDiagonalMm)} mm`} />
              <SpecRow label="Ouverture" value={`f/${formatNumber(lens.apertureMin)} - f/${formatNumber(lens.apertureMax)}`} />
              <SpecRow label="Focus min" value={`${formatNumber(lens.minFocusDistanceMm)} mm`} />
              <SpecRow label="Min. distance travail" value={`${formatNumber(lens.minWorkingDistanceMm)} mm`} />
              <SpecRow label="Distance travail rec." value={lens.recommendedWorkingDistanceMm ? `${formatNumber(lens.recommendedWorkingDistanceMm)} mm` : ""} />
              <SpecRow label="Type" value={lens.lensType} />
              <SpecRow label="Résolution optique" value={lens.opticalResolutionMp ? `${formatNumber(lens.opticalResolutionMp)} MP` : ""} />
              <SpecRow label="Distorsion" value={lens.distortion} />
              <SpecRow label="URL" value={lens.sourceUrl} />
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function SpecHeader({ brand, model }: { brand: string; model: string }) {
  return (
    <div className="rounded-md border border-line bg-white p-3">
      <p className="m-0 text-xs font-bold uppercase text-muted">{brand || "Non renseigné"}</p>
      <strong className="mt-1 block text-ink">{model || "Non renseigné"}</strong>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid gap-1 rounded-md border border-line bg-white p-3 md:grid-cols-[160px_minmax(0,1fr)]">
      <span className="text-xs font-bold uppercase text-muted">{label}</span>
      <span className="min-w-0 break-words text-sm text-ink">{value && value.trim() ? value : "Non renseigné"}</span>
    </div>
  );
}

function NumberField(props: { label: string; unit: string; value: NumericValue | undefined; description?: string; blankZero?: boolean; onChange: (value: NumericValue) => void }) {
  const value = props.value === null || props.value === undefined || (props.blankZero && props.value === 0) ? "" : props.value;

  return (
    <label className={ui.field}>
      <span className={ui.fieldLabel}>{props.label}</span>
      <div className="grid grid-cols-[minmax(0,1fr)_54px]">
        <input
          className={cx(ui.control, "rounded-r-none")}
          type="number"
          min="0"
          step="any"
          value={value}
          onChange={(event) => props.onChange(parseNumberInput(event.target.value))}
        />
        <em className="flex items-center justify-center rounded-r-md border border-l-0 border-line bg-soft text-xs font-bold not-italic text-muted">
          {props.unit}
        </em>
      </div>
      {props.description && <p className="m-0 text-xs leading-5 text-muted">{props.description}</p>}
    </label>
  );
}

function SelectFilter(props: {
  label: string;
  value: NumericValue;
  options: number[];
  onChange: (value: NumericValue) => void;
  suffix?: string;
  digits?: number;
}) {
  return (
    <label className="grid gap-2 text-xs font-bold uppercase tracking-normal text-muted">
      <span>{props.label}</span>
      <select
        className={ui.control}
        value={props.value === null || props.value === undefined ? "" : String(props.value)}
        onChange={(event) => props.onChange(parseNumberInput(event.target.value))}
      >
        <option value="">Toutes</option>
        {props.options.map((option) => (
          <option value={option} key={option}>
            {formatNumber(option, props.digits ?? 2)}{props.suffix ? ` ${props.suffix}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

function Readout(props: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="readout">
      <span>{props.icon}</span>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function TextField(props: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className={ui.field}>
      <span className={ui.fieldLabel}>{props.label}</span>
      <input className={ui.control} value={props.value} onChange={(event) => props.onChange(event.target.value)} />
    </label>
  );
}
