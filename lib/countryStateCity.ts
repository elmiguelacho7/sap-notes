/**
 * Country and region (state) support using country-state-city.
 * Store ISO codes (e.g. ES, CT); display human-readable names.
 * Legacy text values (e.g. "Spain") remain compatible: we display and persist them as-is when not in the list.
 */

import { Country, State } from "country-state-city";

export type CountryOption = { value: string; label: string };
export type StateOption = { value: string; label: string };

let _countries: CountryOption[] | null = null;

/** All countries for dropdowns; value = isoCode, label = name. Sorted by name. */
export function getAllCountryOptions(): CountryOption[] {
  if (_countries) return _countries;
  const list = Country.getAllCountries();
  _countries = list
    .map((c) => ({ value: c.isoCode, label: c.name }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return _countries;
}

/** States/regions for a country; value = state isoCode, label = name. */
export function getStateOptions(countryIsoCode: string): StateOption[] {
  if (!countryIsoCode || countryIsoCode.length !== 2) return [];
  const list = State.getStatesOfCountry(countryIsoCode);
  return list
    .map((s) => ({ value: s.isoCode, label: s.name }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Display name for a stored country value (ISO code or legacy text). */
export function getCountryDisplayName(codeOrName: string | null | undefined): string {
  if (codeOrName == null || codeOrName.trim() === "") return "";
  const trimmed = codeOrName.trim();
  if (trimmed.length === 2) {
    const country = Country.getCountryByCode(trimmed);
    if (country) return country.name;
  }
  const byName = Country.getAllCountries().find(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (byName) return byName.name;
  return trimmed;
}

/** Display name for a stored region/state value (state ISO or legacy text) within a country. */
export function getStateDisplayName(
  countryIsoCode: string | null | undefined,
  stateCodeOrName: string | null | undefined
): string {
  if (stateCodeOrName == null || stateCodeOrName.trim() === "") return "";
  const trimmed = stateCodeOrName.trim();
  if (countryIsoCode && countryIsoCode.length === 2) {
    const state = State.getStateByCodeAndCountry(trimmed, countryIsoCode);
    if (state) return state.name;
    const states = State.getStatesOfCountry(countryIsoCode);
    const byName = states.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());
    if (byName) return byName.name;
  }
  return trimmed;
}

/** Resolve stored value to option value for country select: use isoCode if matched, else keep legacy. */
export function resolveCountryOptionValue(storedValue: string | null | undefined): string {
  if (storedValue == null || storedValue.trim() === "") return "";
  const t = storedValue.trim();
  if (t.length === 2) {
    const c = Country.getCountryByCode(t);
    if (c) return c.isoCode;
  }
  const byName = Country.getAllCountries().find((c) => c.name.toLowerCase() === t.toLowerCase());
  if (byName) return byName.isoCode;
  return t;
}

/** Resolve stored region to option value for state select; countryIsoCode required. */
export function resolveStateOptionValue(
  countryIsoCode: string | null | undefined,
  storedValue: string | null | undefined
): string {
  if (storedValue == null || storedValue.trim() === "") return "";
  if (!countryIsoCode || countryIsoCode.length !== 2) return storedValue.trim();
  const t = storedValue.trim();
  const state = State.getStateByCodeAndCountry(t, countryIsoCode);
  if (state) return state.isoCode;
  const states = State.getStatesOfCountry(countryIsoCode);
  const byName = states.find((s) => s.name.toLowerCase() === t.toLowerCase());
  if (byName) return byName.isoCode;
  return t;
}
