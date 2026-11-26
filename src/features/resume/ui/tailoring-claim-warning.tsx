import type { TailoringClaimWarnings } from "@/entities/resume/model/tailoring-claim-warnings";
import styles from "./tailoring-claim-warning.module.css";

export function TailoringClaimWarning({ warning }: { warning?: TailoringClaimWarnings }) {
  if (!warning) return null;

  return (
    <div className={styles.warning}>
      <strong>연결된 원본에서 확인되지 않는 표현</strong>
      <ul>
        {warning.numbers.length > 0 && <li>수치 {warning.numbers.join(", ")}</li>}
        {warning.technologies.length > 0 && <li>기술 {warning.technologies.join(", ")}</li>}
      </ul>
    </div>
  );
}
