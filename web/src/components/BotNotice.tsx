/**
 * The bot notice (`results.md`, "Bot notice"): fixed copy, a button to Catálogo and a
 * permanent, business-wide dismissal. Whether it shows is the server's decision
 * (plan invariant 4); this component hides nothing itself: after a dismissal it
 * only calls `onDismissed`, and the parent refetches the panel (invariant 10).
 * No toast: the notice just goes.
 */

import { useState } from "react";
import { Link } from "react-router";
import { dismissBotNotice } from "../api/panel";
import Boton from "./Boton";

export default function BotNotice({
  onDismissed,
}: {
  onDismissed: () => void;
}) {
  const [pending, setPending] = useState(false);

  async function dismiss(): Promise<void> {
    setPending(true);
    try {
      await dismissBotNotice();
    } catch {
      // The notice stays: the next Inicio read decides, and a retry is one tap away.
      setPending(false);
      return;
    }
    onDismissed();
  }

  return (
    <section className="aviso-bot">
      <p className="aviso-bot__texto">
        Conectá el bot para publicar tu catálogo en Telegram.
      </p>
      <div className="aviso-bot__acciones">
        <Link to="/catalogo" className="boton">
          Conectar el bot
        </Link>
        <Boton variant="link" disabled={pending} onClick={() => void dismiss()}>
          No mostrar más
        </Boton>
      </div>
    </section>
  );
}
