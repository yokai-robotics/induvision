import type { Camera, CompatibilityLevel, Lens, StudyConfig } from "./types";

export type CameraFilters = {
  sensorFormats: string[];
  fpsMin: number | null;
  fpsMax: number | null;
  resolutionMpMin: number | null;
  resolutionMpMax: number | null;
};

export type SimulationResult = {
  requiredFocalLengthMm: number;
  coveredWidthMm: number;
  coveredHeightMm: number;
  mmPerPixel: number;
  pixelsOnDetail: number;
  objectMaxDimensionMm: number;
  objectFieldOfViewMm: number;
  objectVisibilityTimeS: number;
  objectFrameCount: number;
  objectRoundedFrameCount: number;
  objectCoverageStatus: "Risque de détection insuffisante" | "Acquisition acceptable" | "Bonne couverture de l'objet";
  motionBlurMm: number;
  motionBlurPixels: number;
  sensorDiagonalMm: number;
  horizontalFovDeg: number;
  verticalFovDeg: number;
  mountCompatible: boolean;
  sensorCompatible: boolean;
  fpsCompatible: boolean;
  fieldCompatible: boolean;
  detailCompatible: boolean;
  blurCompatible: boolean;
  focusCompatible: boolean;
  level: CompatibilityLevel;
  score: number;
  issues: string[];
};

export function simulateConfiguration(
  config: StudyConfig,
  camera: Camera,
  lens: Lens
): SimulationResult {
  const sensorWidthMm = numeric(camera.sensorWidthMm);
  const sensorHeightMm = numeric(camera.sensorHeightMm);
  const resolutionWidth = numeric(camera.resolutionWidth);
  const maxFps = numeric(camera.maxFps);
  const focalLengthMm = numeric(lens.focalLengthMm);
  const maxSensorDiagonalMm = numeric(lens.maxSensorDiagonalMm);
  const detectionWidthMm = numeric(config.detectionWidthMm);
  const detectionHeightMm = numeric(config.detectionHeightMm);
  const workingDistanceMm = numeric(config.workingDistanceMm);
  const objectSpeedMS = numeric(config.objectSpeedMmS);
  const minDetailMm = numeric(config.minDetailMm);
  const pixelsPerDetailTarget = numeric(config.pixelsPerDetailTarget);
  const requiredFps = numeric(config.requiredFps);
  const exposureUs = numeric(config.exposureUs);
  const maxMotionBlurPx = numeric(config.maxMotionBlurPx);
  const objectWidthMm = numeric(config.objectWidthCm) * 10;
  const objectHeightMm = numeric(config.objectHeightCm) * 10;
  const objectLengthMm = numeric(config.objectLengthCm) * 10;
  const objectDimensionsMm = [objectWidthMm, objectHeightMm, objectLengthMm].filter((value) => value > 0);
  const minWorkingDistanceMm = numeric(lens.minWorkingDistanceMm) || numeric(lens.minFocusDistanceMm);
  const objectSpeedMmS = objectSpeedMS * 1000;
  const hasRequiredValues = [
    sensorWidthMm,
    sensorHeightMm,
    resolutionWidth,
    focalLengthMm,
    detectionWidthMm,
    detectionHeightMm,
    workingDistanceMm,
    minDetailMm,
    pixelsPerDetailTarget,
    maxMotionBlurPx
  ].every((value) => value > 0);

  const sensorDiagonalMm = Math.hypot(sensorWidthMm, sensorHeightMm);
  const requiredFocalLengthMm = hasRequiredValues
    ? (workingDistanceMm * sensorWidthMm) / detectionWidthMm
    : 0;
  const coveredWidthMm = focalLengthMm > 0 ? (workingDistanceMm * sensorWidthMm) / focalLengthMm : 0;
  const coveredHeightMm = focalLengthMm > 0 ? (workingDistanceMm * sensorHeightMm) / focalLengthMm : 0;
  const mmPerPixel = resolutionWidth > 0 ? coveredWidthMm / resolutionWidth : 0;
  const pixelsOnDetail = mmPerPixel > 0 ? minDetailMm / mmPerPixel : 0;
  const objectMaxDimensionMm = objectDimensionsMm.length > 0 ? Math.max(...objectDimensionsMm) : 0;
  const objectFieldOfViewMm = config.objectTravelAxis === "vertical" ? coveredHeightMm : coveredWidthMm;
  const objectVisibilityTimeS =
    objectSpeedMmS > 0 && Number.isFinite(objectFieldOfViewMm)
      ? (objectFieldOfViewMm + objectMaxDimensionMm) / objectSpeedMmS
      : 0;
  const objectFrameCount = objectVisibilityTimeS > 0 && maxFps > 0 ? objectVisibilityTimeS * maxFps : 0;
  const objectRoundedFrameCount = Math.round(objectFrameCount);
  const objectCoverageStatus =
    objectFrameCount < 3
      ? "Risque de détection insuffisante"
      : objectFrameCount <= 5
        ? "Acquisition acceptable"
        : "Bonne couverture de l'objet";
  const motionBlurMm = objectSpeedMS * 1000 * (exposureUs / 1_000_000);
  const motionBlurPixels = mmPerPixel > 0 ? motionBlurMm / mmPerPixel : 0;
  const horizontalFovDeg = fieldOfViewDeg(sensorWidthMm, focalLengthMm);
  const verticalFovDeg = fieldOfViewDeg(sensorHeightMm, focalLengthMm);

  const mountCompatible = camera.lensMount.toLowerCase() === lens.mount.toLowerCase();
  const cameraSensorFormatSize = sensorFormatRank(camera.sensorFormat);
  const lensSensorFormatSize = sensorFormatRank(lens.sensorFormat);
  const sensorCompatible =
    cameraSensorFormatSize !== null && lensSensorFormatSize !== null
      ? cameraSensorFormatSize <= lensSensorFormatSize
      : maxSensorDiagonalMm > 0 && sensorDiagonalMm <= maxSensorDiagonalMm;
  const fpsCompatible = maxFps >= requiredFps;
  const fieldCompatible =
    hasRequiredValues && coveredWidthMm >= detectionWidthMm && coveredHeightMm >= detectionHeightMm;
  const detailCompatible = hasRequiredValues && pixelsOnDetail >= pixelsPerDetailTarget;
  const blurCompatible = hasRequiredValues && motionBlurPixels <= maxMotionBlurPx;
  const focusCompatible = minWorkingDistanceMm > 0 ? workingDistanceMm >= minWorkingDistanceMm : true;

  const checks = [
    mountCompatible,
    sensorCompatible,
    fpsCompatible,
    fieldCompatible,
    detailCompatible,
    blurCompatible,
    focusCompatible
  ];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  const issues = [
    !mountCompatible ? "Monture caméra/objectif différente." : "",
    !sensorCompatible ? `Format de capteur incompatible (${camera.sensorFormat || "caméra non renseignée"} > ${lens.sensorFormat || "objectif non renseigné"}).` : "",
    !fpsCompatible ? "Cadence caméra inférieure à la cadence demandée." : "",
    !fieldCompatible ? "Champ couvert insuffisant pour la zone de détection." : "",
    !detailCompatible ? "Pas assez de pixels sur le plus petit détail." : "",
    !hasRequiredValues ? "Paramètres numériques incomplets." : "",
    !blurCompatible ? `Flou de mouvement supérieur à ${maxMotionBlurPx} px.` : "",
    !focusCompatible ? "Distance de travail inférieure à la mise au point minimale." : ""
  ].filter(Boolean);

  let level: CompatibilityLevel = "compatible";
  if (score < 72 || !mountCompatible || !sensorCompatible) level = "incompatible";
  else if (score < 100 || motionBlurPixels > maxMotionBlurPx * 0.7) level = "limite";

  return {
    requiredFocalLengthMm,
    coveredWidthMm,
    coveredHeightMm,
    mmPerPixel,
    pixelsOnDetail,
    objectMaxDimensionMm,
    objectFieldOfViewMm,
    objectVisibilityTimeS,
    objectFrameCount,
    objectRoundedFrameCount,
    objectCoverageStatus,
    motionBlurMm,
    motionBlurPixels,
    sensorDiagonalMm,
    horizontalFovDeg,
    verticalFovDeg,
    mountCompatible,
    sensorCompatible,
    fpsCompatible,
    fieldCompatible,
    detailCompatible,
    blurCompatible,
    focusCompatible,
    level,
    score,
    issues
  };
}

function fieldOfViewDeg(sensorDimensionMm: number, focalLengthMm: number) {
  if (sensorDimensionMm <= 0 || focalLengthMm <= 0) return 0;
  return (2 * Math.atan(sensorDimensionMm / (2 * focalLengthMm)) * 180) / Math.PI;
}

function numeric(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function rankConfigurations(config: StudyConfig, cameras: Camera[], lenses: Lens[]) {
  return cameras
    .flatMap((camera) =>
      lenses.map((lens) => ({
        camera,
        lens,
        result: simulateConfiguration(config, camera, lens)
      }))
    )
    .sort((a, b) => {
      if (b.result.score !== a.result.score) return b.result.score - a.result.score;
      if (a.result.motionBlurPixels !== b.result.motionBlurPixels) {
        return a.result.motionBlurPixels - b.result.motionBlurPixels;
      }
      return Math.abs(a.result.requiredFocalLengthMm - numeric(a.lens.focalLengthMm)) -
        Math.abs(b.result.requiredFocalLengthMm - numeric(b.lens.focalLengthMm));
    });
}

export function cameraMegapixels(camera: Camera) {
  const width = numeric(camera.resolutionWidth);
  const height = numeric(camera.resolutionHeight);
  if (width <= 0 || height <= 0) return 0;
  return (width * height) / 1_000_000;
}

export function filterCameras(cameras: Camera[], filters: CameraFilters) {
  const sensorFormats = filters.sensorFormats.map(normalizeSensorFormatName).filter(Boolean);
  const [fpsMin, fpsMax] = orderedRange(filters.fpsMin, filters.fpsMax);
  const [resolutionMin, resolutionMax] = orderedRange(filters.resolutionMpMin, filters.resolutionMpMax);

  return cameras.filter((camera) => {
    const cameraFps = numeric(camera.maxFps);
    const cameraResolutionMp = cameraMegapixels(camera);
    const sensorFormat = normalizeSensorFormatName(camera.sensorFormat);
    const sensorFormatOk =
      sensorFormats.length === 0 || sensorFormats.includes(sensorFormat);
    const fpsOk =
      (!Number.isFinite(fpsMin) || cameraFps >= fpsMin) &&
      (!Number.isFinite(fpsMax) || cameraFps <= fpsMax);
    const resolutionOk =
      (!Number.isFinite(resolutionMin) || cameraResolutionMp >= resolutionMin) &&
      (!Number.isFinite(resolutionMax) || cameraResolutionMp <= resolutionMax);

    return sensorFormatOk && fpsOk && resolutionOk;
  });
}

export function objectPixelsAtDistance(
  camera: Camera,
  lens: Lens,
  dimensionMm: number,
  distanceMm: number
) {
  const sensorWidthMm = numeric(camera.sensorWidthMm);
  const resolutionWidth = numeric(camera.resolutionWidth);
  const focalLengthMm = numeric(lens.focalLengthMm);
  if (sensorWidthMm <= 0 || resolutionWidth <= 0 || focalLengthMm <= 0 || dimensionMm <= 0 || distanceMm <= 0) {
    return 0;
  }
  return (dimensionMm * resolutionWidth * focalLengthMm) / (distanceMm * sensorWidthMm);
}

function sensorFormatRank(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[”″]/g, '"')
    .replace(/''/g, '"')
    .replace(/\s+/g, "")
    .replace(/pouces?|inch(?:es)?/g, '"');
  const match = normalized.match(/(\d+(?:[,.]\d+)?)(?:\/(\d+(?:[,.]\d+)?))?/);
  if (!match) return null;
  const numerator = Number(match[1].replace(",", "."));
  const denominator = match[2] ? Number(match[2].replace(",", ".")) : 1;
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return numerator / denominator;
}

function normalizeSensorFormatName(value: string) {
  return value
    .toLowerCase()
    .replace(/[”″]/g, '"')
    .replace(/''/g, '"')
    .replace(/\s+/g, "")
    .replace(/pouces?|inch(?:es)?/g, '"');
}

function orderedRange(a: number | null, b: number | null): [number, number] {
  const values = [a, b].filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (values.length === 0) return [Number.NaN, Number.NaN];
  if (values.length === 1) return [values[0], values[0]];
  return values[0] <= values[1] ? [values[0], values[1]] : [values[1], values[0]];
}

export function formatNumber(value: number | null | undefined, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Non renseigné";
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(value);
}
