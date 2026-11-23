import { Parcel, ProviderTrackingResult, RawProviderEvent, TrackingProviderId } from '../../types.js';

export interface RegisterTrackingInput {
  awb: string;
  carrierCode: string;
  carrierName: string;
  originCountry?: string;
  originFlag?: string;
  destinationCountry: string;
  destinationFlag: string;
}

export interface TrackingProvider {
  readonly id: TrackingProviderId;
  readonly displayName: string;
  isConfigured(apiKey?: string): boolean;
  registerAndFetch(input: RegisterTrackingInput, apiKey?: string): Promise<ProviderTrackingResult>;
  fetchUpdates(parcel: Parcel, apiKey?: string): Promise<ProviderTrackingResult>;
  parseWebhook?(payload: unknown): { awb: string; events: RawProviderEvent[]; estimatedDelivery?: string | null } | null;
}
