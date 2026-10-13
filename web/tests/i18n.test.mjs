import assert from "node:assert/strict";
import test from "node:test";
import { localizedNumber, translate } from "../i18n/translations.ts";

// Storage and calculations supply French messages, including nested errors.
test("English displays nested storage errors without losing their details", () => {
  const error = "Enregistrement impossible : Les études ont changé dans un autre onglet. Recharge la page avant d’enregistrer.";
  assert.equal(translate("en", error), "Unable to save: Studies have changed in another tab. Reload the page before saving.");
  assert.equal(translate("fr", error), error);
  assert.equal(translate("en", "Import impossible : Valeur invalide : requiredFps."), "Unable to import: Invalid value: requiredFps.");
});

test("calculation warnings translate their parameters and missing formats", () => {
  assert.equal(translate("en", "Flou de mouvement supérieur à 1.5 px."), "Motion blur exceeds 1.5 px.");
  assert.equal(translate("en", "Format de capteur incompatible (caméra non renseignée > 1/2\")."), "Incompatible sensor format (camera format not specified > 1/2\").");
  assert.equal(translate("en", "2 étude(s) importée(s). Les références absentes du catalogue ont été remplacées."), "2 studies imported. References missing from the catalog have been replaced.");
  assert.equal(translate("en", "1 étude(s) importée(s). Les références absentes du catalogue ont été remplacées."), "1 study imported. References missing from the catalog have been replaced.");
});

test("formatting follows the selected language and handles missing numbers", () => {
  assert.equal(localizedNumber("en", 1234.5), "1,234.50");
  assert.equal(localizedNumber("fr", 1234.5).replace(/\s/g, " "), "1 234,50");
  assert.equal(localizedNumber("en", null), "Not specified");
  assert.equal(localizedNumber("fr", Number.NaN), "Non renseigné");
});

test("translation keeps model identifiers and substitutes named values in either language", () => {
  assert.equal(translate("en", "Basler ace acA1920-40gm"), "Basler ace acA1920-40gm");
  assert.equal(translate("en", "Courbes de {min} à {max} m pour le couple sélectionné.", {min: "0.3", max: "20"}), "Curves from 0.3 to 20 m for the selected pair.");
  assert.equal(translate("fr", "Étude {number}", {number: 3}), "Étude 3");
});
