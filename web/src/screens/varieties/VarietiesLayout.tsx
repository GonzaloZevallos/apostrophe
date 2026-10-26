/**
 * The `/varieties` layout route (`VariedadesCompu.dc.html`), as `ClientesLayout` is for
 * Clientes: on a computer the list stays on the left and the active child route fills the
 * right pane (a variety's page, or the new-variety form drawn over them); on a phone it is
 * the child alone, which for `/varieties` itself is the list. The selection is the URL.
 *
 * The price form's route is a modal over the panes (`PrecioNuevoCompu.dc.html`): on a computer
 * the list and that variety's page are drawn behind it, both `inert` and `aria-hidden`, with
 * the form as their sibling. On a phone the same wrapper holds the form alone, so a resize
 * across 900 px never remounts it and what was typed is kept.
 *
 * The stock entry form keeps the whole width on a computer, as it always had. On a phone it is a sheet
 * (ADR-0053) over its parent on a direct address: new over Varieties, edit over All entries, drawn as
 * an inert, hidden `BehindPane`. `{!computer && …}` leaves the pane's place, so the form keeps one
 * index on both viewports and a resize across 900 px never remounts it.
 */

import { useQuery } from "@tanstack/react-query";
import { Outlet, useMatch, useOutletContext } from "react-router";
import { get } from "../../api/client";
import { keys } from "../../api/keys";
import type { Me } from "../../api/me";
import type { VarietyDetail } from "../../api/varieties";
import BehindPane from "../../components/BehindPane";
import {
  ARCHIVED_VARIETIES,
  STOCK_ENTRY,
  STOCK_ENTRY_NEW,
  VARIETY,
  VARIETY_PRICE_NEW,
} from "../../routes";
import { useViewport } from "../../shell/useViewport";
import Variedades from "../Variedades";
import ArchivedVarieties from "./ArchivedVarieties";
import EntriesBehind from "./EntriesBehind";
import VarietiesBehind from "./VarietiesBehind";
import { VarietyPageBehind } from "./VarietyPage";

export default function VarietiesLayout() {
  const me = useOutletContext<Me>();
  const computer = useViewport() === "computer";
  // The left pane is the Archivadas card on its own route and beside an archived variety's
  // page (the same query as the page's own, so no extra request); the live list otherwise.
  const onArchivedCard = useMatch(ARCHIVED_VARIETIES) !== null;
  const varietyId = useMatch(VARIETY)?.params.id;
  // The variety the price form is for: its page is drawn behind the form.
  const priceFormFor = useMatch(VARIETY_PRICE_NEW)?.params.id;
  const { data: opened } = useQuery({
    queryKey: keys.variety(varietyId ?? ""),
    queryFn: () => get<VarietyDetail>(`/varieties/${varietyId}`),
    enabled: computer && varietyId !== undefined && /^[0-9]+$/.test(varietyId),
  });
  const onStockNew = useMatch(STOCK_ENTRY_NEW) !== null;
  const editedEntry = useMatch(STOCK_ENTRY)?.params.id;
  const onStockEdit =
    !onStockNew && editedEntry !== undefined && /^[0-9]+$/.test(editedEntry);
  const archivedPane = onArchivedCard || opened?.archived === true;
  if (priceFormFor !== undefined) {
    const behind = /^[0-9]+$/.test(priceFormFor) ? Number(priceFormFor) : null;
    return (
      <div
        className={
          computer
            ? "variedades-paneles"
            : "variedades-paneles variedades-paneles--solo"
        }
      >
        {computer && (
          <div className="variedades-paneles__lista" inert aria-hidden="true">
            {archivedPane ? <ArchivedVarieties /> : <Variedades />}
          </div>
        )}
        {computer && (
          <div className="variedades-paneles__detalle" inert aria-hidden="true">
            {behind !== null && <VarietyPageBehind varietyId={behind} />}
          </div>
        )}
        <Outlet context={me} />
      </div>
    );
  }
  if (onStockNew || onStockEdit) {
    return (
      <>
        {!computer && (
          <BehindPane>
            {onStockNew ? <VarietiesBehind /> : <EntriesBehind />}
          </BehindPane>
        )}
        <Outlet context={me} />
      </>
    );
  }
  if (!computer) return <Outlet context={me} />;
  return (
    <div className="variedades-paneles">
      <div className="variedades-paneles__lista">
        {archivedPane ? <ArchivedVarieties /> : <Variedades />}
      </div>
      <div className="variedades-paneles__detalle">
        <Outlet context={me} />
      </div>
    </div>
  );
}
