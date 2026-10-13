export type NumericValue = number | null;

export type Camera = {
  id: string;
  brand: string;
  model: string;
  sourceUrl?: string;
  cameraType: "Area scan" | "Line scan" | "3D" | "Smart camera";
  sensorTechnology: "" | "CMOS" | "CCD";
  colorMode: "" | "Monochrome" | "Couleur";
  sensorFormat: string;
  sensorSupplier: string;
  sensorModel: string;
  resolutionWidth: NumericValue;
  resolutionHeight: NumericValue;
  sensorWidthMm: NumericValue;
  sensorHeightMm: NumericValue;
  pixelSizeUm: NumericValue;
  maxFps: NumericValue;
  interfaceType: string;
  shutter: "" | "Global shutter" | "Rolling shutter";
  lensMount: string;
  bitDepth: string;
  exposureRange: string;
  notes?: string;
};

export type Lens = {
  id: string;
  brand: string;
  model: string;
  sourceUrl?: string;
  focalLengthMm: NumericValue;
  mount: string;
  sensorFormat: string;
  maxSensorDiagonalMm: NumericValue;
  apertureMin: NumericValue;
  apertureMax: NumericValue;
  minFocusDistanceMm: NumericValue;
  minWorkingDistanceMm: NumericValue;
  recommendedWorkingDistanceMm?: NumericValue;
  lensType: "" | "Standard" | "Télécentrique" | "Macro" | "Grand angle";
  opticalResolutionMp?: NumericValue;
  distortion?: string;
  notes?: string;
};

export type StudyConfig = {
  detectionWidthMm: NumericValue;
  detectionHeightMm: NumericValue;
  workingDistanceMm: NumericValue;
  objectSpeedMmS: NumericValue;
  minDetailMm: NumericValue;
  pixelsPerDetailTarget: NumericValue;
  requiredFps: NumericValue;
  exposureUs: NumericValue;
  maxMotionBlurPx: NumericValue;
  objectWidthCm: NumericValue;
  objectHeightCm: NumericValue;
  objectLengthCm: NumericValue;
  objectTravelAxis: "horizontal" | "vertical";
};

export type Study = StudyConfig & {
  id: string;
  name: string;
  sensorFormats?: string;
  fpsMin?: NumericValue;
  fpsMax?: NumericValue;
  resolutionMpMin?: NumericValue;
  resolutionMpMax?: NumericValue;
  selectedCameraId?: string;
  selectedLensId?: string;
  comparisonPairs?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CompatibilityLevel = "compatible" | "limite" | "incompatible";
