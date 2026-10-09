"use server";

import Discourse, { HTTPError } from "discourse2";
import { revalidatePath } from "next/cache";
import { getCurrentSqlUserId } from "@/auth/session";
import { db } from "@/db/neonFull";
import {
  createSqlDiscourseSync,
  type DiscourseSyncState,
  type DiscourseSyncTransport,
  initialDiscourseSyncState,
  MAGICKLY_DISCOURSE_ORIGIN,
} from "@/temples/discourseSync";
import {
  createSqlTempleForumService,
  resolveForumSyncTarget,
} from "@/temples/forum";
import {
  FORUM_SYNC_DEADLINE_MS,
  forumFetchOptions,
  readCappedText,
} from "@/temples/forumHttp";

function safeId(value: number) {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new Error("Invalid Discourse response");
  return value;
}

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid Discourse response");
  return value as Record<string, unknown>;
}

function stringValue(value: unknown) {
  if (typeof value !== "string" || !value)
    throw new Error("Invalid Discourse response");
  return value;
}

function nullableStringValue(value: unknown) {
  if (value === null) return null;
  return stringValue(value);
}

/**
 * A forum may be anyone's: never follow a redirect with the key attached, and
 * give each request a timer of its own (a shared one would already be spent).
 */
const safe = () => ({ fetchOptions: forumFetchOptions() });

function createDiscourseTransport(config: {
  origin: string;
  apiUsername: string;
  apiKey: string;
}): DiscourseSyncTransport {
  const { origin, apiUsername, apiKey } = config;
  const discourse = new Discourse(origin, {
    "Api-Key": apiKey,
    "Api-Username": apiUsername,
  });

  return {
    async listGroupsPage(page) {
      const url = new URL("/groups.json", origin);
      url.searchParams.set("page", page.toString());
      const response = await fetch(url, {
        ...forumFetchOptions(),
        headers: {
          "Api-Key": apiKey,
          "Api-Username": apiUsername,
        },
      });
      if (!response.ok) throw new Error("Discourse group list failed");
      const payload = objectValue(JSON.parse(await readCappedText(response)));
      if (!Array.isArray(payload.groups))
        throw new Error("Invalid Discourse response");
      return {
        groups: payload.groups.map((value) => {
          const group = objectValue(value);
          return {
            id: safeId(Number(group.id)),
            name: stringValue(group.name),
            title: nullableStringValue(group.title),
          };
        }),
      };
    },

    async createGroup(seed) {
      const result = await discourse.createGroup(
        {
          group: {
            name: seed.name,
            full_name: seed.fullName,
            visibility_level: 2,
            primary_group: true,
          },
        },
        { validateParams: false, ...safe() },
      );
      return {
        id: safeId(result.basic_group.id),
        name: result.basic_group.name,
        title: result.basic_group.title,
      };
    },

    async configureGroup(groupId, seed) {
      const group = {
        name: seed.name,
        full_name: seed.fullName,
        title: seed.title,
        mentionable_level: 3,
        messageable_level: 3,
        visibility_level: 2,
        primary_group: true,
        public_admission: false,
        public_exit: false,
        allow_membership_requests: false,
        default_notification_level: 3,
        members_visibility_level: 2,
      };
      await discourse.updateGroup(
        { id: safeId(groupId), group } as Parameters<
          typeof discourse.updateGroup
        >[0],
        { validateParams: false, ...safe() },
      );
    },

    async listGroupMemberPage(groupName, offset) {
      const url = new URL(
        `/groups/${encodeURIComponent(groupName)}/members.json`,
        origin,
      );
      url.searchParams.set("offset", offset.toString());
      const response = await fetch(url, {
        ...forumFetchOptions(),
        headers: {
          "Api-Key": apiKey,
          "Api-Username": apiUsername,
        },
      });
      if (!response.ok) throw new Error("Discourse group member list failed");
      const payload = objectValue(JSON.parse(await readCappedText(response)));
      const meta = objectValue(payload.meta);
      if (!Array.isArray(payload.members))
        throw new Error("Invalid Discourse response");
      return {
        memberIds: payload.members.map((value) =>
          safeId(Number(objectValue(value).id)),
        ),
        total: Number(meta.total),
        limit: Number(meta.limit),
        offset: Number(meta.offset),
      };
    },

    async getUser(userId) {
      try {
        const result = await discourse.adminGetUser(
          { id: safeId(userId) },
          safe(),
        );
        return {
          id: safeId(result.id),
          username: result.username,
          title: result.title,
          primaryGroupId: result.primary_group_id,
        };
      } catch (error) {
        if (error instanceof HTTPError && error.status === 404) return null;
        throw error;
      }
    },

    async findUsersByEmail(email) {
      const result = await discourse.adminListUsers(
        {
          flag: "active",
          email,
        },
        safe(),
      );
      return result.map((candidate) => ({ id: safeId(candidate.id) }));
    },

    async createUser(input) {
      const result = await discourse.createUser(
        {
          name: input.name,
          email: input.email,
          password: input.password,
          username: input.username,
          active: true,
          approved: true,
        },
        safe(),
      );
      return {
        success: result.success,
        userId: result.user_id ? safeId(result.user_id) : null,
      };
    },

    async updateUsername(username, newUsername) {
      await discourse.updateUsername(
        { username, new_username: newUsername },
        safe(),
      );
    },

    async addGroupMember(groupId, username) {
      await discourse.addGroupMembers(
        {
          id: safeId(groupId),
          usernames: username,
        },
        safe(),
      );
    },

    async removeGroupMember(groupId, username) {
      await discourse.removeGroupMembers(
        {
          id: safeId(groupId),
          usernames: username,
        },
        safe(),
      );
    },

    async setPrimaryGroup(userId, groupId) {
      const response = await fetch(
        `${origin}/admin/users/${safeId(userId)}/primary_group`,
        {
          ...forumFetchOptions(),
          method: "PUT",
          headers: {
            "Api-Key": apiKey,
            "Api-Username": apiUsername,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            primary_group_id: safeId(groupId).toString(),
          }),
        },
      );
      if (!response.ok)
        throw new Error("Discourse primary group update failed");
    },

    async setTitle(username, title) {
      await discourse.updateUser(
        { username, title } as Parameters<typeof discourse.updateUser>[0],
        { validateParams: false, ...safe() },
      );
    },
  };
}

/** Stops a sync that a slow or hostile forum is dragging out. */
function withDeadline(
  transport: DiscourseSyncTransport,
): DiscourseSyncTransport {
  const deadline = Date.now() + FORUM_SYNC_DEADLINE_MS;
  return Object.fromEntries(
    Object.entries(transport).map(([name, call]) => [
      name,
      (...args: unknown[]) => {
        if (Date.now() > deadline) throw new Error("The sync took too long.");
        return (call as (...input: unknown[]) => unknown)(...args);
      },
    ]),
  ) as unknown as DiscourseSyncTransport;
}

export async function discourseSync(
  _previous: DiscourseSyncState,
  formData: FormData,
): Promise<DiscourseSyncState> {
  const fail = (message: string): DiscourseSyncState => ({
    ...initialDiscourseSyncState,
    status: "error",
    message,
  });
  const expectedActorId = formData.get("actorId");
  const templeId = formData.get("templeId");
  if (typeof expectedActorId !== "string" || typeof templeId !== "string")
    return fail("The sync request is invalid.");
  const currentActorId = await getCurrentSqlUserId();
  if (currentActorId !== expectedActorId)
    return fail("Temple administrator access is required.");

  const target = await resolveForumSyncTarget(db, {
    actorId: expectedActorId,
    templeId,
  });
  if (target.kind === "error") return fail(target.message);
  if (target.kind === "own")
    return createSqlDiscourseSync(db, {
      getCurrentActorId: getCurrentSqlUserId,
      transport: withDeadline(createDiscourseTransport(target.credentials)),
      forumOrigin: target.credentials.origin,
      access: "temple",
      pruneFormerMembers: true,
    })({ expectedActorId, templeId });

  // No forum of its own: the site-wide forum, for global administrators.
  const apiKey = process.env.DISCOURSE_API_KEY;
  if (!apiKey) return fail("Discourse sync is not configured.");
  return createSqlDiscourseSync(db, {
    getCurrentActorId: getCurrentSqlUserId,
    transport: withDeadline(
      createDiscourseTransport({
        origin: MAGICKLY_DISCOURSE_ORIGIN,
        apiUsername: "system",
        apiKey,
      }),
    ),
    access: "global",
  })({ expectedActorId, templeId });
}

export interface ForumSettingsState {
  status: "idle" | "saved" | "cleared" | "error";
  message: string;
  /** What was typed, so a refusal does not wipe the form. Never the key. */
  values?: { origin: string; apiUsername: string };
}

/** Saves, or with `intent=clear` removes, this temple's forum connection. */
export async function saveTempleForumAction(
  _previous: ForumSettingsState,
  formData: FormData,
): Promise<ForumSettingsState> {
  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  const service = createSqlTempleForumService(db, getCurrentSqlUserId);
  const clearing = text("intent") === "clear";
  const result = clearing
    ? await service.clear({
        version: 1,
        expectedActorId: text("actorId"),
        templeId: text("templeId"),
      })
    : await service.save({
        version: 1,
        expectedActorId: text("actorId"),
        templeId: text("templeId"),
        origin: text("origin"),
        apiUsername: text("apiUsername"),
        apiKey: text("apiKey"),
      });
  if (!result.ok)
    return {
      status: "error",
      message: result.message,
      values: { origin: text("origin"), apiUsername: text("apiUsername") },
    };
  // The page is also reachable by legacy ids, so refresh every temple page.
  revalidatePath("/temples/admin/[_id]", "page");
  return clearing
    ? { status: "cleared", message: "The forum connection was removed." }
    : { status: "saved", message: "The forum connection was saved." };
}
