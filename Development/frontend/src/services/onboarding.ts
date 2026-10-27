import { api } from "@/lib/api";
import { AuthUser } from "./auth";

export interface CompanyProfile {
  id?: number;
  tenantId?: number;
  userId?: number;
  companyName: string;
  industry: string;
  website?: string | null;
  contactEmail: string;
  organizationType: string;
  gstin?: string | null;
  isGstRegistered: boolean;
  country: string;
  state?: string | null;
  city: string;
  postalCode: string;
  address: string;
  fleetSize: string;
  primaryApplication: string;
  description?: string | null;
  isCompleted?: boolean;
}

export interface OnboardingStatusResponse {
  onboardingCompleted: boolean;
  company: CompanyProfile | null;
  tenant: {
    id: number;
    name: string;
  };
}

export interface CompleteOnboardingResponse {
  success: boolean;
  message: string;
  user: AuthUser;
  company: CompanyProfile;
  token?: string;
}

export async function getOnboardingStatus(): Promise<OnboardingStatusResponse> {
  const { data } = await api.get<OnboardingStatusResponse>("/onboarding");
  return data;
}

export async function saveOnboardingDraft(
  payload: Partial<CompanyProfile>
): Promise<{ message: string; company: CompanyProfile }> {
  const { data } = await api.post<{ message: string; company: CompanyProfile }>("/onboarding/draft", payload);
  return data;
}

export async function completeOnboarding(
  payload: CompanyProfile
): Promise<CompleteOnboardingResponse> {
  const { data } = await api.post<CompleteOnboardingResponse>("/onboarding/complete", payload);
  return data;
}
