/**
 * Lets React run a commit's effects before a Testing Library wait returns.
 *
 * `findBy…` and `waitFor` return as soon as the DOM matches. React commits
 * the DOM and runs that commit's `useEffect`s in a later scheduler task
 * when the work has outrun its 5 ms slice, which load makes common. Testing
 * Library's own wrapper then waits a `setTimeout(0)`, which Node runs before
 * that task, so a test went on with a listener not yet added or a mount
 * effect not yet run: the dictionary's Escape went unhandled and
 * `ResearchHostedChat`'s child counted no mount (21–22 November 2026).
 * An empty `act` after the wait runs those effects. Node environment files
 * skip the import.
 */
export {};

if (typeof document !== "undefined") {
  const { act, configure, getConfig } = await import("@testing-library/react");
  const { asyncWrapper } = getConfig();
  configure({
    asyncWrapper: async (callback) => {
      const result = await asyncWrapper(callback);
      await act(async () => {});
      return result;
    },
  });
}
