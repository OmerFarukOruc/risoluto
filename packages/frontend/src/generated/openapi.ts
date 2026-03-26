/* eslint-disable */
export interface paths {
  "/api/v1/{issue_identifier}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Get issue detail */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          /** @description Issue identifier */
          issue_identifier: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Issue detail */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              attempts?: ({
                attemptId: string;
                attemptNumber?: number | null;
                endedAt?: string | null;
                errorCode?: string | null;
                errorMessage?: string | null;
                startedAt?: string;
                status: string;
              } & {
                [key: string]: unknown;
              })[];
              currentAttemptId?: string | null;
              identifier: string;
              issueId: string;
              state: string;
              title: string;
            } & {
              [key: string]: unknown;
            };
          };
        };
        /** @description Unknown issue identifier */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/{issue_identifier}/abort": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Abort a running issue */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          /** @description Issue identifier */
          issue_identifier: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Abort already requested */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              already_stopping: boolean;
              ok: boolean;
              requested_at: string;
              status: string;
            };
          };
        };
        /** @description Abort accepted */
        202: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              already_stopping: boolean;
              ok: boolean;
              requested_at: string;
              status: string;
            };
          };
        };
        /** @description Unknown issue identifier */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
        /** @description Abort could not be queued */
        409: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/{issue_identifier}/attempts": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** List archived attempts for an issue */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          /** @description Issue identifier */
          issue_identifier: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Issue attempts */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              attempts: ({
                attemptId: string;
                attemptNumber?: number | null;
                endedAt?: string | null;
                errorCode?: string | null;
                errorMessage?: string | null;
                startedAt?: string;
                status: string;
              } & {
                [key: string]: unknown;
              })[];
              current_attempt_id: string | null;
            };
          };
        };
        /** @description Unknown issue identifier */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/{issue_identifier}/model": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Override the model selection for an issue */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          /** @description Issue identifier */
          issue_identifier: string;
        };
        cookie?: never;
      };
      /** @description Model override payload */
      requestBody: {
        content: {
          "application/json": {
            model: string;
            reasoning_effort?: ("none" | "minimal" | "low" | "medium" | "high" | "xhigh") | null;
            reasoningEffort?: ("none" | "minimal" | "low" | "medium" | "high" | "xhigh") | null;
          };
        };
      };
      responses: {
        /** @description Model override accepted */
        202: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              applies_next_attempt: boolean;
              restarted: boolean;
              selection: {
                model: string;
                reasoning_effort: string | null;
                source: string;
              };
              updated: boolean;
            };
          };
        };
        /** @description Invalid model payload */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
        /** @description Unknown issue identifier */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/{issue_identifier}/transition": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Transition an issue to a new state */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          /** @description Issue identifier */
          issue_identifier: string;
        };
        cookie?: never;
      };
      /** @description Transition target payload */
      requestBody: {
        content: {
          "application/json": {
            target_state: string;
          };
        };
      };
      responses: {
        /** @description Transition applied */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              from: string;
              /** @constant */
              ok: true;
              to: string;
            };
          };
        };
        /** @description Missing target state */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
        /** @description Unknown issue identifier */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
        /** @description Transition rejected */
        422: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              /** @constant */
              ok: false;
              reason: string;
            };
          };
        };
        /** @description Linear client unavailable */
        503: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/attempts/{attempt_id}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Get a specific attempt detail */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          /** @description Attempt identifier */
          attempt_id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Attempt detail */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              attemptId: string;
              events?: ({
                at: string;
                attemptId?: string;
                content?: string | null;
                event: string;
                issueId?: string | null;
                issueIdentifier?: string | null;
                message?: string;
                metadata?: unknown;
                rateLimits?: unknown;
                sessionId?: string | null;
                usage?: unknown;
              } & {
                [key: string]: unknown;
              })[];
              status: string;
            } & {
              [key: string]: unknown;
            };
          };
        };
        /** @description Unknown attempt identifier */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/config": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Get effective sanitized config */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Effective config */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              [key: string]: unknown;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/config/overlay": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Get persisted overlay config */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Config overlay */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              overlay: {
                [key: string]: unknown;
              };
            };
          };
        };
      };
    };
    /** Apply an overlay patch */
    put: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      /** @description Overlay patch payload */
      requestBody: {
        content: {
          "application/json": {
            [key: string]: unknown;
          };
        };
      };
      responses: {
        /** @description Overlay updated */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              overlay: {
                [key: string]: unknown;
              };
              updated: boolean;
            };
          };
        };
        /** @description Invalid overlay payload */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
      };
    };
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/config/overlay/{path}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    /** Delete a single overlay path */
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          /** @description Overlay path expression */
          path: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Overlay path removed */
        204: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
        /** @description Invalid overlay path */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
        /** @description Overlay path not found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
      };
    };
    options?: never;
    head?: never;
    /** Set a single overlay path */
    patch: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          /** @description Overlay path expression */
          path: string;
        };
        cookie?: never;
      };
      /** @description Path value payload */
      requestBody: {
        content: {
          "application/json": {
            value: unknown;
          };
        };
      };
      responses: {
        /** @description Overlay updated */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              overlay: {
                [key: string]: unknown;
              };
              updated: boolean;
            };
          };
        };
        /** @description Invalid overlay payload */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
      };
    };
    trace?: never;
  };
  "/api/v1/config/schema": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Get config API schema hints */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Config API schema hints */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              overlay_put_body_examples: unknown[];
              routes: {
                [key: string]: string;
              };
            } & {
              [key: string]: unknown;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/events": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Subscribe to control-plane invalidation events */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Server-sent event stream */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "text/event-stream": string;
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/git/context": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Get git and GitHub context */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Git context */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              activeBranches: {
                branchName: string;
                identifier: string;
                issueTitle: string;
                pullRequestUrl: string | null;
                status: string;
                workspacePath: string | null;
              }[];
              githubAvailable: boolean;
              repos: {
                configured: boolean;
                defaultBranch: string;
                github?: {
                  description: string | null;
                  openPrCount: number;
                  pulls: {
                    author: string;
                    checksStatus: string | null;
                    headBranch: string;
                    number: number;
                    state: string;
                    title: string;
                    updatedAt: string;
                    url: string;
                  }[];
                  recentCommits: {
                    author: string;
                    date: string;
                    message: string;
                    sha: string;
                  }[];
                  visibility: string;
                };
                githubOwner: string | null;
                githubRepo: string | null;
                identifierPrefix: string | null;
                label: string | null;
                repoUrl: string;
              }[];
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/refresh": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Queue a refresh pass */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Refresh accepted */
        202: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              coalesced: boolean;
              queued: boolean;
              requested_at: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/runtime": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Get runtime metadata */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Runtime metadata */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              data_dir: string;
              feature_flags: {
                [key: string]: boolean;
              };
              provider_summary: string;
              version: string;
              workflow_path: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/secrets": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** List stored secret keys */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Configured secret keys */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              keys: string[];
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/secrets/{key}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Store a secret value */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          /** @description Secret key */
          key: string;
        };
        cookie?: never;
      };
      /** @description Secret payload */
      requestBody: {
        content: {
          "application/json": {
            value: string;
          };
        };
      };
      responses: {
        /** @description Secret stored */
        204: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
        /** @description Invalid secret payload */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
      };
    };
    /** Delete a secret */
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          /** @description Secret key */
          key: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Secret deleted */
        204: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
        /** @description Invalid secret key */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
        /** @description Secret not found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/setup/codex-auth": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Store Codex auth.json */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      /** @description Codex auth payload */
      requestBody: {
        content: {
          "application/json": {
            authJson: string;
          };
        };
      };
      responses: {
        /** @description Codex auth stored */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              ok: boolean;
            };
          };
        };
        /** @description Invalid auth payload */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
        /** @description Auth save failed */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/setup/create-label": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Create the Symphony Linear label */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Label created */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              alreadyExists: boolean;
              labelId: string;
              labelName: string;
              ok: boolean;
            };
          };
        };
        /** @description Missing setup prerequisites */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
        /** @description Linear API request failed */
        502: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/setup/create-project": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Create a Linear project */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      /** @description Project creation payload */
      requestBody: {
        content: {
          "application/json": {
            name: string;
          };
        };
      };
      responses: {
        /** @description Project created */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              ok: boolean;
              project: {
                id?: string;
                name?: string;
                slugId: string;
                teamKey: string;
                url: string | null;
              };
            };
          };
        };
        /** @description Invalid project payload */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
        /** @description Linear API request failed */
        502: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/setup/create-test-issue": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Create a Linear test issue */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Test issue created */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              issueIdentifier: string;
              issueUrl: string;
              ok: boolean;
            };
          };
        };
        /** @description Missing setup prerequisites */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
        /** @description Linear API request failed */
        502: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/setup/detect-default-branch": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Detect a repository default branch */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      /** @description Repository URL payload */
      requestBody: {
        content: {
          "application/json": {
            repoUrl: string;
          };
        };
      };
      responses: {
        /** @description Detected default branch */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              defaultBranch: string;
            };
          };
        };
        /** @description Invalid repository URL */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/setup/github-token": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Validate and store the GitHub token */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      /** @description GitHub token payload */
      requestBody: {
        content: {
          "application/json": {
            token: string;
          };
        };
      };
      responses: {
        /** @description GitHub token validation result */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              valid: boolean;
            };
          };
        };
        /** @description Missing GitHub token */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/setup/linear-project": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Persist the selected Linear project */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      /** @description Selected Linear project payload */
      requestBody: {
        content: {
          "application/json": {
            slugId: string;
          };
        };
      };
      responses: {
        /** @description Project selected */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              ok: boolean;
            };
          };
        };
        /** @description Missing project slug */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/setup/linear-projects": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** List available Linear projects */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Linear projects */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              projects: {
                id: unknown;
                name: unknown;
                slugId: unknown;
                teamKey: string | null;
              }[];
            };
          };
        };
        /** @description Linear API key missing */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
        /** @description Linear API request failed */
        502: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/setup/master-key": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Initialize or provide the master key */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      /** @description Optional master key payload */
      requestBody: {
        content: {
          "application/json": {
            key?: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      responses: {
        /** @description Master key initialized */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              key: string;
            };
          };
        };
        /** @description Master key already initialized */
        409: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
        /** @description Setup failed */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/setup/openai-key": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Validate and store the OpenAI key */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      /** @description OpenAI API key payload */
      requestBody: {
        content: {
          "application/json": {
            key: string;
          };
        };
      };
      responses: {
        /** @description OpenAI key validation result */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              valid: boolean;
            };
          };
        };
        /** @description Missing OpenAI key */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/setup/pkce-auth/cancel": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Cancel PKCE authentication flow */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description PKCE flow cancelled */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              ok: boolean;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/setup/pkce-auth/start": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Start PKCE authentication flow */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description PKCE flow started */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              authUrl: string;
            };
          };
        };
        /** @description PKCE setup failed */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
        /** @description Auth endpoint unreachable */
        502: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/setup/pkce-auth/status": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Poll PKCE authentication status */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description PKCE status */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  /** @constant */
                  status: "idle";
                }
              | {
                  /** @constant */
                  status: "pending";
                }
              | {
                  /** @constant */
                  status: "complete";
                }
              | {
                  error: string;
                  /** @constant */
                  status: "error";
                }
              | {
                  error: string;
                  /** @constant */
                  status: "expired";
                };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/setup/prompt-template": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Get the current prompt template */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Prompt template */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              isDefault: boolean;
              template: string;
            };
          };
        };
      };
    };
    put?: never;
    /** Update the prompt template */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      /** @description Prompt template payload */
      requestBody: {
        content: {
          "application/json": {
            template: string;
          };
        };
      };
      responses: {
        /** @description Prompt template updated */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              isDefault: boolean;
              ok: boolean;
            };
          };
        };
        /** @description Missing prompt template */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/setup/repo-route": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Create or replace a repo route */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      /** @description Repo route payload */
      requestBody: {
        content: {
          "application/json": {
            defaultBranch?: string;
            identifierPrefix: string;
            label?: string;
            repoUrl: string;
          };
        };
      };
      responses: {
        /** @description Repo route stored */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              ok: boolean;
              route: {
                default_branch: string;
                identifier_prefix: string;
                label?: string;
                repo_url: string;
              };
            };
          };
        };
        /** @description Invalid repo route payload */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
      };
    };
    /** Delete a repo route by index */
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      /** @description Repo route delete payload */
      requestBody: {
        content: {
          "application/json": {
            index: number;
          };
        };
      };
      responses: {
        /** @description Repo route deleted */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              ok: boolean;
              routes: {
                default_branch: string;
                identifier_prefix: string;
                label?: string;
                repo_url: string;
              }[];
            };
          };
        };
        /** @description Invalid repo route index */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/setup/repo-routes": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** List configured repo routes */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Configured repo routes */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              routes: {
                default_branch: string;
                identifier_prefix: string;
                label?: string;
                repo_url: string;
              }[];
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/setup/reset": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Reset setup state */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Setup reset */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              ok: boolean;
            };
          };
        };
        /** @description Reset failed */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/setup/status": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Get setup wizard progress */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Setup progress */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              configured: boolean;
              steps: {
                githubToken: {
                  done: boolean;
                };
                linearProject: {
                  done: boolean;
                };
                masterKey: {
                  done: boolean;
                };
                openaiKey: {
                  done: boolean;
                };
                repoRoute: {
                  done: boolean;
                };
              };
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/state": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Get the current orchestrator snapshot */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Current runtime state */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              codex_totals: {
                input_tokens: number;
                output_tokens: number;
                seconds_running: number;
                total_tokens: number;
              };
              completed: {
                attempt: number | null;
                blockedBy?: {
                  id: string | null;
                  identifier: string | null;
                  state: string | null;
                }[];
                branchName?: string | null;
                configuredModel?: string | null;
                configuredModelSource?: string | null;
                configuredReasoningEffort?: string | null;
                createdAt?: string | null;
                description?: string | null;
                error: string | null;
                identifier: string;
                issueId: string;
                labels?: string[];
                lastEventAt?: string | null;
                message: string | null;
                model?: string | null;
                modelChangePending?: boolean;
                modelSource?: string | null;
                nextRetryDueAt?: string | null;
                priority?: number | null;
                pullRequestUrl?: string | null;
                reasoningEffort?: string | null;
                startedAt?: string | null;
                state: string;
                status: string;
                title: string;
                tokenUsage?: {
                  inputTokens: number;
                  outputTokens: number;
                  totalTokens: number;
                } | null;
                updatedAt: string;
                url?: string | null;
                workspaceKey: string | null;
                workspacePath?: string | null;
              }[];
              counts: {
                retrying: number;
                running: number;
              } & {
                [key: string]: number;
              };
              generated_at: string;
              queued: {
                attempt: number | null;
                blockedBy?: {
                  id: string | null;
                  identifier: string | null;
                  state: string | null;
                }[];
                branchName?: string | null;
                configuredModel?: string | null;
                configuredModelSource?: string | null;
                configuredReasoningEffort?: string | null;
                createdAt?: string | null;
                description?: string | null;
                error: string | null;
                identifier: string;
                issueId: string;
                labels?: string[];
                lastEventAt?: string | null;
                message: string | null;
                model?: string | null;
                modelChangePending?: boolean;
                modelSource?: string | null;
                nextRetryDueAt?: string | null;
                priority?: number | null;
                pullRequestUrl?: string | null;
                reasoningEffort?: string | null;
                startedAt?: string | null;
                state: string;
                status: string;
                title: string;
                tokenUsage?: {
                  inputTokens: number;
                  outputTokens: number;
                  totalTokens: number;
                } | null;
                updatedAt: string;
                url?: string | null;
                workspaceKey: string | null;
                workspacePath?: string | null;
              }[];
              rate_limits: unknown;
              recent_events: {
                at: string;
                content: string | null;
                event: string;
                issue_id: string | null;
                issue_identifier: string | null;
                message: string;
                metadata: unknown;
                session_id: string | null;
              }[];
              retrying: {
                attempt: number | null;
                blockedBy?: {
                  id: string | null;
                  identifier: string | null;
                  state: string | null;
                }[];
                branchName?: string | null;
                configuredModel?: string | null;
                configuredModelSource?: string | null;
                configuredReasoningEffort?: string | null;
                createdAt?: string | null;
                description?: string | null;
                error: string | null;
                identifier: string;
                issueId: string;
                labels?: string[];
                lastEventAt?: string | null;
                message: string | null;
                model?: string | null;
                modelChangePending?: boolean;
                modelSource?: string | null;
                nextRetryDueAt?: string | null;
                priority?: number | null;
                pullRequestUrl?: string | null;
                reasoningEffort?: string | null;
                startedAt?: string | null;
                state: string;
                status: string;
                title: string;
                tokenUsage?: {
                  inputTokens: number;
                  outputTokens: number;
                  totalTokens: number;
                } | null;
                updatedAt: string;
                url?: string | null;
                workspaceKey: string | null;
                workspacePath?: string | null;
              }[];
              running: {
                attempt: number | null;
                blockedBy?: {
                  id: string | null;
                  identifier: string | null;
                  state: string | null;
                }[];
                branchName?: string | null;
                configuredModel?: string | null;
                configuredModelSource?: string | null;
                configuredReasoningEffort?: string | null;
                createdAt?: string | null;
                description?: string | null;
                error: string | null;
                identifier: string;
                issueId: string;
                labels?: string[];
                lastEventAt?: string | null;
                message: string | null;
                model?: string | null;
                modelChangePending?: boolean;
                modelSource?: string | null;
                nextRetryDueAt?: string | null;
                priority?: number | null;
                pullRequestUrl?: string | null;
                reasoningEffort?: string | null;
                startedAt?: string | null;
                state: string;
                status: string;
                title: string;
                tokenUsage?: {
                  inputTokens: number;
                  outputTokens: number;
                  totalTokens: number;
                } | null;
                updatedAt: string;
                url?: string | null;
                workspaceKey: string | null;
                workspacePath?: string | null;
              }[];
              stall_events?: {
                at: string;
                issue_id: string;
                issue_identifier: string;
                silent_ms: number;
                timeout_ms: number;
              }[];
              system_health?: {
                checked_at: string;
                message: string;
                running_count: number;
                status: "healthy" | "degraded" | "critical";
              };
              workflow_columns: {
                count: number;
                issues: ({
                  identifier: string;
                } & {
                  [key: string]: unknown;
                })[];
                key: string;
                kind: string;
                label: string;
                terminal: boolean;
              }[];
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/transitions": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** List available state transitions */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Available transitions */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              transitions: {
                [key: string]: string[];
              };
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/workspaces": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** List known workspaces */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Workspace inventory */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              active: number;
              generated_at: string;
              orphaned: number;
              total: number;
              workspaces: {
                disk_bytes: number | null;
                issue: {
                  identifier: string;
                  state: string;
                  title: string;
                } | null;
                last_modified_at: string | null;
                path: string;
                status: "running" | "retrying" | "completed" | "orphaned";
                strategy: string;
                workspace_key: string;
              }[];
            };
          };
        };
        /** @description Workspace config unavailable */
        503: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/workspaces/{workspace_key}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    /** Remove a workspace */
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          /** @description Workspace key */
          workspace_key: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Workspace removed */
        204: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
        /** @description Invalid workspace key */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
        /** @description Workspace not found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
        /** @description Workspace is still active */
        409: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
        /** @description Workspace config unavailable */
        503: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: {
                code: string;
                message: string;
              };
            };
          };
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/metrics": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Get Prometheus metrics */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Prometheus metrics payload */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "text/plain": string;
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
}
export type webhooks = Record<string, never>;
export interface components {
  schemas: never;
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
