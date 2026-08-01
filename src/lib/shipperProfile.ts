const PROFILE_KEY = "3dxap-shipper-profile-v1";

export type ShipperProfile = {
  name: string;
  email: string;
  phone: string;
  company_document: string;
  state_register: string;
  economic_activity_code: string;
  address: string;
  complement: string;
  number: string;
  district: string;
  city: string;
  postal_code: string;
  state_abbr: string;
};

export function defaultShipperProfile(): ShipperProfile {
  return {
    name: "3DXAP — Paula Pacheco",
    email: "",
    phone: "49991167161",
    company_document: "60010228000194",
    state_register: "ISENTO",
    economic_activity_code: "",
    address: "",
    complement: "",
    number: "",
    district: "",
    city: "Chapecó",
    postal_code: "",
    state_abbr: "SC",
  };
}

export function loadShipperProfile(): ShipperProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return defaultShipperProfile();
    return { ...defaultShipperProfile(), ...JSON.parse(raw) };
  } catch {
    return defaultShipperProfile();
  }
}

export function saveShipperProfile(profile: ShipperProfile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  return profile;
}
