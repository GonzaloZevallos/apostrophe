/**
 * Step 4, "Conectá tu bot de Telegram": the owner's integrations form without its link to
 * the catalog. A successful Probarlo (the only save) asks `/onboarding-progress` again, keeps
 * that answer and then passes the step as `done`; a failed one shows its reason and sends
 * nothing. "Hecho" comes only from the server's `done`. The line that says where the catalog
 * is published, and "Seguir", show once the bot is saved (`done`) or Probarlo just succeeded
 * (`tested`, a local flag that drives nothing else). "Seguir" asks again before it passes.
 * "Saltar" belongs to the frame.
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { NetworkError, get } from "../../api/client";
import { keys } from "../../api/keys";
import {
  getOnboardingProgress,
  keepProgress,
  sendPass,
} from "../../api/onboarding";
import ErrorGenerico from "../../components/ErrorGenerico";
import Loading from "../../components/Loading";
import SinConexion from "../../components/SinConexion";
import {
  IntegrationsForm,
  type PinnedCatalog,
} from "../settings/IntegrationsGroup";
import { PUBLISH_LINE } from "./onboardingMessages";
import { useOnboardingWrite } from "./useOnboardingWrite";
import type { StepBodyProps } from "./stepBodies";

export default function BotStep({
  progress,
  onDirtyChange,
  onProgress,
}: StepBodyProps) {
  const query = useQuery({
    queryKey: keys.pinnedCatalog(),
    queryFn: () => get<PinnedCatalog>("/pinned-catalog"),
  });
  const queryClient = useQueryClient();
  const [tested, setTested] = useState(false);
  const { run, sending, notice } = useOnboardingWrite(onProgress);
  const done =
    progress.steps.find((item) => item.step === "bot")?.state === "done";
  // The fresh answer first, so "Hecho" is the server's; a failed read sends no pass.
  const send = () =>
    run(async () => {
      keepProgress(queryClient, await getOnboardingProgress());
      return sendPass("bot", "done");
    });

  if (query.data === undefined) {
    if (query.isError)
      return query.error instanceof NetworkError ? (
        <SinConexion />
      ) : (
        <ErrorGenerico />
      );
    return <Loading />;
  }
  return (
    <>
      {done && <span className="onboarding__insignia">Hecho</span>}
      <IntegrationsForm
        initial={query.data}
        showCatalogLink={false}
        onDirtyChange={onDirtyChange}
        onSaved={() => {
          setTested(true);
          void send();
        }}
      />
      {(done || tested) && (
        <>
          <p className="pie">{PUBLISH_LINE}</p>
          <button
            type="button"
            className="boton"
            disabled={sending}
            onClick={() => void send()}
          >
            Seguir
          </button>
        </>
      )}
      {notice}
    </>
  );
}
