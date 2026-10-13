# InduVision

InduVision is a browser-based tool for choosing cameras and lenses for industrial
vision applications, provided by [Yokaï Robotics](https://yokainco.com/).

Define the area to inspect, the smallest detail to detect, the working distance,
and the object's speed. Compare camera–lens combinations and estimate whether
they meet your imaging requirements.

## Features

- Browse camera and lens specifications in searchable catalogs.
- Estimate field of view, image resolution, detail visibility, and motion blur.
- Compare configurations, including object size in pixels at different distances.
- Estimate camera bandwidth requirements for GigE networks.
- Save studies in your browser and transfer them through JSON import and export.

The study tool, camera catalog, lens catalog, and GigE calculator each have their
own page: `/study/`, `/cameras/`, `/lenses/`, and `/gige/`.

## How it works

InduVision runs as a static website, with no accounts, database, or server API.
Camera and lens specifications are maintained in JSON files. Calculations run
in the browser, and saved studies remain on your device without being sent to a
server. Clearing the site's browser data removes those studies; JSON exports
let you keep a backup or move them to another device.

The interface is available in French and English. Use the FR / EN selector to
switch languages; your choice is remembered in your browser.

Run `npm run build` from the project root to generate the static site in
`out/oqjljzdba7/`.
