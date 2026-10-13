export const sectionRoutes = {
  study: "/study/",
  cameras: "/cameras/",
  lenses: "/lenses/",
  network: "/gige/"
} as const;

export type Section = keyof typeof sectionRoutes;

export function sectionForPath(pathname: string): Section {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  for (const [section, route] of Object.entries(sectionRoutes)) {
    if (route.replace(/\/$/, "") === normalized) return section as Section;
  }
  return "study";
}
