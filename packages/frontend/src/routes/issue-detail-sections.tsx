/* eslint-disable @typescript-eslint/naming-convention */
import type { ChangeEvent, ReactElement } from "react";
import { Link } from "react-router-dom";

import {
  computeDurationSeconds,
  formatCompactNumber,
  formatDuration,
  formatShortTime,
  formatTimestamp,
} from "../../../../frontend/src/utils/format.js";
import {
  REASONING_EFFORT_OPTIONS,
  type AttemptSummary,
  type IssueDetail,
  type RecentEvent,
} from "../../../../frontend/src/types.js";
import styles from "./IssueDetail.module.css";
import { detailUpdatedAt, eventKey, statusLabel, stringifyEventContent } from "./issue-detail-helpers.js";

function SummaryCard({
  label,
  value,
  mono = false,
}: Readonly<{ label: string; value: string; mono?: boolean }>): ReactElement {
  return (
    <article className={styles.statCard}>
      <p className={styles.label}>{label}</p>
      <p className={mono ? `${styles.value} ${styles.mono}` : styles.value}>{value}</p>
    </article>
  );
}

export function IssueHeader({ detail }: Readonly<{ detail: IssueDetail }>): ReactElement {
  return (
    <header className={`${styles.panel} ${styles.header}`}>
      <div className={styles.titleBlock}>
        <p className={`issue-identifier ${styles.eyebrow} ${styles.issueIdentifier}`}>{detail.identifier}</p>
        <h1 id="issue-detail-title" className={`issue-title ${styles.issueTitle}`}>
          {detail.title}
        </h1>
      </div>
      <div className={styles.headerMeta}>
        <span className={`status-badge ${styles.statusBadge}`} data-status={detail.status}>
          {statusLabel(detail.status)}
        </span>
        <p className={styles.updatedAt}>Updated {formatTimestamp(detailUpdatedAt(detail))}</p>
        <div className={styles.buttonRow}>
          <Link className={styles.linkButton} to={`/issues/${detail.identifier}/logs`}>
            Open logs
          </Link>
          {detail.url ? (
            <a className={styles.button} href={detail.url} target="_blank" rel="noreferrer">
              Open tracker
            </a>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export function IssueSummaryStrip({ detail }: Readonly<{ detail: IssueDetail }>): ReactElement {
  return (
    <div className={styles.summaryStrip}>
      <SummaryCard label="Priority" value={String(detail.priority ?? "—")} />
      <SummaryCard label="Model" value={detail.model ?? "—"} mono />
      <SummaryCard label="Tokens" value={formatCompactNumber(detail.tokenUsage?.totalTokens ?? null)} mono />
      <SummaryCard
        label="Duration"
        value={formatDuration(computeDurationSeconds(detail.startedAt, detailUpdatedAt(detail)))}
        mono
      />
    </div>
  );
}

export function IssueDetailsSection({ detail }: Readonly<{ detail: IssueDetail }>): ReactElement {
  return (
    <section className={styles.panel}>
      <h2 className={styles.sectionTitle}>Details & blockers</h2>
      <p className={styles.description}>{detail.description?.trim() || "Not exposed yet"}</p>
    </section>
  );
}

export function WorkspaceSection({ detail }: Readonly<{ detail: IssueDetail }>): ReactElement {
  const branchName = detail.branchName ?? detail.branch_name ?? "—";
  const pullRequestUrl = detail.pull_request_url ?? null;

  return (
    <section className={styles.panel}>
      <h2 className={styles.sectionTitle}>Workspace & git</h2>
      <div className={styles.metaGrid}>
        <article className={styles.metaCard}>
          <p className={styles.label}>Workspace</p>
          <p className={`${styles.metaValue} ${styles.mono}`}>{detail.workspacePath ?? detail.workspaceKey ?? "—"}</p>
        </article>
        <article className={styles.metaCard}>
          <p className={styles.label}>Branch</p>
          <p className={`${styles.metaValue} ${styles.mono}`}>{branchName}</p>
        </article>
        <article className={styles.metaCard}>
          <p className={styles.label}>Pull request</p>
          <p className={styles.metaValue}>
            {pullRequestUrl ? (
              <a href={pullRequestUrl} target="_blank" rel="noreferrer">
                {pullRequestUrl}
              </a>
            ) : (
              "—"
            )}
          </p>
        </article>
        <article className={styles.metaCard}>
          <p className={styles.label}>Last event</p>
          <p className={`${styles.metaValue} ${styles.mono}`}>
            {formatTimestamp(detail.lastEventAt ?? detailUpdatedAt(detail))}
          </p>
        </article>
      </div>
    </section>
  );
}

type ModelSectionProps = Readonly<{
  detail: IssueDetail;
  model: string;
  reasoningEffort: string;
  savePending: boolean;
  saveError: string | null;
  onModelChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onReasoningChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  onSubmit: () => void | Promise<void>;
}>;

export function ModelSection(props: ModelSectionProps): ReactElement {
  const { detail, model, reasoningEffort, savePending, saveError, onModelChange, onReasoningChange, onSubmit } = props;

  return (
    <section className={styles.panel}>
      <h2 className={styles.sectionTitle}>Model settings</h2>
      <div className={styles.summaryStrip}>
        <SummaryCard label="Active model" value={detail.model ?? "—"} mono />
        <SummaryCard label="Reasoning" value={detail.reasoningEffort ?? "—"} mono />
        <SummaryCard label="Configured model" value={detail.configuredModel ?? detail.model ?? "—"} mono />
        <SummaryCard
          label="Change state"
          value={detail.modelChangePending ? "Pending next run" : "Using active config"}
        />
      </div>
      <form
        className={styles.formGrid}
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit();
        }}
      >
        <label className={styles.field}>
          <span className={styles.label}>Model</span>
          <input className={styles.input} value={model} onChange={onModelChange} required />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Reasoning effort</span>
          <select className={styles.select} value={reasoningEffort} onChange={onReasoningChange}>
            <option value="">Follow active default</option>
            {REASONING_EFFORT_OPTIONS.map((option) => (
              <option key={option} value={option === "none" ? "" : option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <button className={styles.submitButton} type="submit" disabled={savePending}>
          {savePending ? "Saving…" : "Save"}
        </button>
      </form>
      <p className={styles.note}>
        {saveError ??
          (detail.modelChangePending
            ? "Saved change pending — applies on the next run."
            : "Applies next run. Active worker keeps its current model.")}
      </p>
    </section>
  );
}

type AttemptTimelineProps = Readonly<{
  attempts: AttemptSummary[];
  selectedAttemptId: string | null;
  onAttemptSelect: (attemptId: string) => void;
}>;

export function AttemptTimelineSection({
  attempts,
  selectedAttemptId,
  onAttemptSelect,
}: AttemptTimelineProps): ReactElement {
  return (
    <section className={styles.panel}>
      <h2 className={styles.sectionTitle}>Attempt timeline</h2>
      <div className={styles.attemptsTableWrap}>
        <table className={`attempts-table ${styles.attemptsTable}`}>
          <thead>
            <tr>
              <th>Run#</th>
              <th>Status</th>
              <th>Start</th>
              <th>End</th>
              <th>Duration</th>
              <th>Model</th>
              <th>Tokens</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {attempts.length === 0 ? (
              <tr>
                <td colSpan={8} className={styles.emptyState}>
                  No attempts yet.
                </td>
              </tr>
            ) : (
              attempts.map((attempt) => (
                <tr
                  key={attempt.attemptId}
                  className={styles.attemptRow}
                  data-selected={String(attempt.attemptId === selectedAttemptId)}
                  onClick={() => onAttemptSelect(attempt.attemptId)}
                >
                  <td>{attempt.attemptNumber ?? "—"}</td>
                  <td>{attempt.status}</td>
                  <td className={styles.mono}>{formatShortTime(attempt.startedAt)}</td>
                  <td className={styles.mono}>{formatShortTime(attempt.endedAt)}</td>
                  <td className={styles.mono}>
                    {formatDuration(computeDurationSeconds(attempt.startedAt, attempt.endedAt))}
                  </td>
                  <td className={styles.mono}>{attempt.model ?? "—"}</td>
                  <td className={styles.mono}>{formatCompactNumber(attempt.tokenUsage?.totalTokens ?? null)}</td>
                  <td>{attempt.errorMessage ?? attempt.errorCode ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type EventStreamProps = Readonly<{
  selectedAttempt: AttemptSummary | null;
  events: RecentEvent[];
  eventError: string | null;
}>;

export function EventStreamSection({ selectedAttempt, events, eventError }: EventStreamProps): ReactElement {
  return (
    <section className={styles.panel}>
      <h2 className={styles.sectionTitle}>
        {selectedAttempt ? `Event stream · Run #${selectedAttempt.attemptNumber}` : "Event stream"}
      </h2>
      {eventError ? <p className={styles.errorState}>{eventError}</p> : null}
      <div className={styles.eventList}>
        {events.length === 0 ? (
          <p className={styles.emptyState}>No recent activity yet.</p>
        ) : (
          events.map((event) => {
            const content = stringifyEventContent(event.content);
            return (
              <article key={eventKey(event)} className={`event-row ${styles.eventRow}`}>
                <div className={styles.eventMeta}>
                  <time className={styles.mono} dateTime={event.at}>
                    {formatTimestamp(event.at)}
                  </time>
                  <span className={styles.eventType}>{statusLabel(event.event)}</span>
                </div>
                <p className={styles.eventMessage}>{event.message}</p>
                {content ? <pre className={styles.eventContent}>{content}</pre> : null}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
