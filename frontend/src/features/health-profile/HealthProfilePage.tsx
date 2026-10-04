"use client";

import { Lock } from "lucide-react";
import { useState, type FormEvent } from "react";

import { MedicalDisclaimer } from "@/components/domain/MedicalDisclaimer";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DetailList,
  EmptyState,
  FormActions,
  LoadingState,
  PageHeader,
  QueryState,
} from "@/components/ui";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useToast } from "@/hooks/useToast";
import { getFieldErrors } from "@/lib/api/errors";
import { formatDate, humanize } from "@/lib/format";
import { useProfileQuery, useUpdateProfileMutation } from "@/services/profiles";
import type { Req } from "@/services/types";
import type { PatientProfile } from "@/types/api";

import { BLOOD_TYPE_LABELS, PROFILE_FIELDS, SEX_LABELS, formatNumber } from "./config";
import { HealthInfoTabs } from "./HealthInfoTabs";
import { RecordFields, bodyFromValues, valuesFromItem, type FormValues } from "./RecordForm";

function BasicsForm({ profile }: { profile: PatientProfile }) {
  const [values, setValues] = useState<FormValues>(() => valuesFromItem(PROFILE_FIELDS, profile));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [update, { isLoading }] = useUpdateProfileMutation();
  const toast = useToast();

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const height = values.height_cm;
    if (typeof height === "string" && height && !(Number(height) > 0)) {
      setErrors({ height_cm: "Enter a height greater than 0." });
      return;
    }
    setErrors({});
    try {
      const body = bodyFromValues(PROFILE_FIELDS, values) as Req<"PatchedPatientProfileRequest">;
      await update({ id: profile.id, ...body }).unwrap();
      toast.success("Health profile saved.");
    } catch (err) {
      const fieldErrors = getFieldErrors(err);
      setErrors(fieldErrors);
      if (!Object.keys(fieldErrors).length) toast.error(err);
    }
  };

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-4">
      <RecordFields
        fields={PROFILE_FIELDS}
        values={values}
        errors={errors}
        disabled={isLoading}
        onChange={(name, value) => setValues((prev) => ({ ...prev, [name]: value }))}
      />
      <FormActions>
        <Button type="submit" loading={isLoading}>
          Save changes
        </Button>
      </FormActions>
    </form>
  );
}

function BasicsReadOnly({ profile }: { profile: PatientProfile }) {
  return (
    <DetailList
      items={[
        {
          label: "Date of birth",
          value: profile.date_of_birth ? formatDate(profile.date_of_birth) : null,
        },
        {
          label: "Sex",
          value: profile.sex ? (SEX_LABELS[profile.sex] ?? humanize(profile.sex)) : null,
        },
        {
          label: "Blood type",
          value: profile.blood_type ? BLOOD_TYPE_LABELS[profile.blood_type] : null,
        },
        {
          label: "Height",
          value: profile.height_cm ? `${formatNumber(profile.height_cm)} cm` : null,
        },
        { label: "Phone", value: profile.phone },
        {
          label: "Address",
          value: [profile.address, profile.city, profile.country].filter(Boolean).join(", "),
        },
        {
          label: "Notes",
          value: profile.notes ? (
            <span className="whitespace-pre-line">{profile.notes}</span>
          ) : null,
        },
      ]}
    />
  );
}

export function HealthProfilePage() {
  const { profile: active, isLoading, can } = useActiveProfile();
  const profileQuery = useProfileQuery(active?.id ?? "", { skip: !active?.id });
  const canManage = can("MANAGE_PROFILE");

  if (isLoading || !active) return <LoadingState />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Health profile"
        description={
          active.is_self
            ? "Your basics, allergies, conditions, vitals and care team."
            : `Health information for ${active.full_name}.`
        }
        badge={
          !canManage && can("VIEW_PROFILE") ? <Badge tone="neutral">View only</Badge> : undefined
        }
      />
      {!can("VIEW_PROFILE") ? (
        <Card>
          <EmptyState
            icon={Lock}
            title="You don't have access to this health profile"
            description={`Ask ${active.owner_name || "the profile owner"} to grant you the “View health profile” permission.`}
          />
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader
              title="Basics"
              description={
                canManage
                  ? "Keep these details up to date for appointments and emergencies."
                  : undefined
              }
            />
            <CardBody>
              <QueryState query={profileQuery}>
                {(profile) =>
                  canManage ? (
                    <BasicsForm key={`${profile.id}-${profile.updated_at}`} profile={profile} />
                  ) : (
                    <BasicsReadOnly profile={profile} />
                  )
                }
              </QueryState>
            </CardBody>
          </Card>
          <HealthInfoTabs key={active.id} />
          <MedicalDisclaimer />
        </>
      )}
    </div>
  );
}
