"use client";

import { useState } from "react";
import { useTranslation } from "../i18n/LanguageProvider";
import type { Camera, Lens } from "../app/types";

const labels: Record<string, string> = {
  cameraType: "Type de caméra", sensorTechnology: "Technologie capteur", colorMode: "Mono / couleur", sensorFormat: "Format capteur", sensorSupplier: "Fabricant du capteur", sensorModel: "Capteur", resolutionWidth: "Résolution largeur (px)", resolutionHeight: "Résolution hauteur (px)", sensorWidthMm: "Largeur capteur (mm)", sensorHeightMm: "Hauteur capteur (mm)", pixelSizeUm: "Taille du pixel (µm)", maxFps: "Cadence maximale (fps)", interfaceType: "Interface", shutter: "Obturateur", lensMount: "Monture", bitDepth: "Profondeur de bits", exposureRange: "Exposition", focalLengthMm: "Focale (mm)", mount: "Monture", maxSensorDiagonalMm: "Diagonale capteur maximale (mm)", apertureMin: "Ouverture minimale (f/)", apertureMax: "Ouverture maximale (f/)", minFocusDistanceMm: "Mise au point minimale (mm)", minWorkingDistanceMm: "Distance de travail minimale (mm)", recommendedWorkingDistanceMm: "Distance de travail recommandée (mm)", lensType: "Type d’objectif", opticalResolutionMp: "Résolution optique (MP)", distortion: "Distorsion"
};

export function CatalogPanel({ title, items }: { title: string; items: Array<Camera | Lens> }) {
  const { t, formatNumber } = useTranslation();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");
  const filtered = items.filter((item) => `${item.brand} ${item.model}`.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr")));
  const selected = filtered.find((item) => item.id === selectedId) ?? filtered[0];
  return (
    <div className="catalog-layout">
      <section className="panel">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h3 className="m-0 text-xl font-semibold">{title}</h3>
          <span className="catalog-count">{filtered.length}{t(" modèles")}</span>
        </div>
        <label className="mb-6 grid gap-2 text-xs font-semibold text-muted">{t("Rechercher par marque ou modèle")}<input className="control" value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder={t("Marque, modèle…")} />
        </label>
        <div className="grid max-h-[65vh] gap-2 overflow-y-auto pr-1">
          {filtered.map((item) => (
            <button key={item.id} type="button" aria-pressed={selected?.id === item.id} onClick={() => setSelectedId(item.id)} className="catalog-row">
              <strong className="mb-1 block text-sm font-semibold">{item.brand} {item.model}</strong>
              <span className="text-sm text-muted">{item.sensorFormat || t("Format non renseigné")} · {"maxFps" in item ? `${item.maxFps ?? "—"} fps` : `${item.focalLengthMm ?? "—"} mm`}</span>
            </button>
          ))}
          {!filtered.length && <p role="status">{t("Aucun modèle ne correspond à cette recherche.")}</p>}
        </div>
      </section>
      {selected && (
        <section className="panel catalog-details">
          <p className="eyebrow">{t("Fiche technique")}</p>
          <h3 className="m-0 mb-6 break-words text-2xl font-semibold leading-tight">{selected.brand} {selected.model}</h3>
          <dl className="mb-6 grid">
            {Object.entries(selected).filter(([field]) => labels[field]).map(([field, value]) => (
              <div key={field} className="grid gap-2 border-t border-line py-3 sm:grid-cols-2">
                <dt className="text-xs font-semibold text-muted">{t(labels[field])}</dt>
                <dd className="m-0 break-words text-sm">{value === null || value === "" ? t("Non renseigné") : typeof value === "number" ? formatNumber(value, Number.isInteger(value) ? 0 : 3) : t(String(value))}</dd>
              </div>
            ))}
          </dl>
          {selected.sourceUrl && <a className="text-sm font-semibold text-accent hover:underline" href={selected.sourceUrl} target="_blank" rel="noreferrer">{t("Voir la fiche fabricant ")}<span aria-hidden="true">↗</span></a>}
          {selected.notes && <details className="mt-6 border-t border-line pt-5 text-sm"><summary className="cursor-pointer font-semibold">{t("Notes et provenance")}</summary><p className="mt-3 whitespace-pre-wrap break-words text-muted">{selected.notes}</p></details>}
        </section>
      )}
    </div>
  );
}
