import { StudyConfig } from "./types";

export const initialStudyConfig: StudyConfig = {
  detectionWidthMm: 120,
  detectionHeightMm: 80,
  workingDistanceMm: 300,
  objectSpeedMmS: 0.45,
  minDetailMm: 0.35,
  pixelsPerDetailTarget: 4,
  requiredFps: 40,
  exposureUs: 500,
  maxMotionBlurPx: 1,
  objectWidthCm: 20,
  objectHeightCm: 10,
  objectLengthCm: 30,
  objectTravelAxis: "horizontal"
};
