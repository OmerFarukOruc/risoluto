import type { ChangeEvent, ReactElement } from "react";
import { useParams } from "react-router-dom";

import { useSSE } from "../hooks/useSSE.js";
import styles from "./IssueDetail.module.css";
import {
  AttemptTimelineSection,
  EventStreamSection,
  IssueDetailsSection,
  IssueHeader,
  IssueSummaryStrip,
  ModelSection,
  WorkspaceSection,
} from "./issue-detail-sections.js";
import { useIssueDetailRouteData } from "./use-issue-detail-route-data.js";

// eslint-disable-next-line @typescript-eslint/naming-convention
export function IssueDetailRoute(): ReactElement {
  const { issue_identifier: issueIdentifierParam } = useParams<{ issue_identifier: string }>();
  const issueIdentifier = issueIdentifierParam ?? "";
  useSSE();
  const {
    issueQuery,
    attemptsQuery,
    attempts,
    selectedAttemptId,
    selectedAttempt,
    events,
    model,
    reasoningEffort,
    saveMutation,
    eventError,
    setSelectedAttemptId,
    setModelValue,
    setReasoningEffortValue,
    submitModelOverride,
  } = useIssueDetailRouteData(issueIdentifier);

  if (issueIdentifier.length === 0)
    return (
      <section className={styles.page}>
        <div className={`${styles.panel} ${styles.errorState}`}>Issue identifier is required.</div>
      </section>
    );
  if (issueQuery.isPending || attemptsQuery.isPending)
    return (
      <section className={styles.page}>
        <div className={styles.panel}>Loading issue detail…</div>
      </section>
    );
  if (issueQuery.isError)
    return (
      <section className={styles.page}>
        <div className={`${styles.panel} ${styles.errorState}`}>{issueQuery.error.message}</div>
      </section>
    );

  const detail = issueQuery.data;

  return (
    <section className={styles.page} aria-labelledby="issue-detail-title">
      <IssueHeader detail={detail} />
      <IssueSummaryStrip detail={detail} />
      <IssueDetailsSection detail={detail} />
      <WorkspaceSection detail={detail} />
      <ModelSection
        detail={detail}
        model={model}
        reasoningEffort={reasoningEffort}
        savePending={saveMutation.isPending}
        saveError={saveMutation.isError ? saveMutation.error.message : null}
        onModelChange={(event: ChangeEvent<HTMLInputElement>) => {
          setModelValue(event.target.value);
        }}
        onReasoningChange={(event: ChangeEvent<HTMLSelectElement>) => {
          setReasoningEffortValue(event.target.value);
        }}
        onSubmit={submitModelOverride}
      />
      <AttemptTimelineSection
        attempts={attempts}
        selectedAttemptId={selectedAttemptId}
        onAttemptSelect={setSelectedAttemptId}
      />
      <EventStreamSection selectedAttempt={selectedAttempt} events={events} eventError={eventError} />
    </section>
  );
}
