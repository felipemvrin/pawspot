export type PlaceCategory =
  | 'park'
  | 'restaurant'
  | 'cafe'
  | 'petFriendly'
  | 'veterinary'
  | 'trail'
  | 'hotel'
  | 'shopping'
  | 'hairSalon';

export type Place = {
  id: string;
  name: string;
  category: PlaceCategory;
  rating: number;
  address: string;
  lat: number;
  lng: number;
};
