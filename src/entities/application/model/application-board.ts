import {
  APPLICATION_STATUS_OPTIONS,
  type ApplicationRecord
} from "@/entities/application/model/application-record";

export function groupApplicationRecordsByStatus(records: ApplicationRecord[]) {
  return APPLICATION_STATUS_OPTIONS.map(({ id, label }) => ({
    status: id,
    label,
    records: records.filter((record) => record.status === id)
  }));
}
