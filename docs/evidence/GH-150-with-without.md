# GH-150: compare.sh with and without the `.disposicion .ajustes-grupo` hunk

## Sides

- **With:** `fe7bdef95cf2af9f034c6baf0cff1cf95dd84978` (the branch's merge-base and `origin/master` at the time; it already holds the hunk and `web/e2e/insets.spec.ts`).
- **Without:** local commit `279af14d21eb22eb3e03f5a1ac591550c4ea014c` on top of the same commit, in a scratch clone with its own `npm ci` (a `git worktree` is denied by a hook). Never pushed. Its diff (1 file changed, 1 insertion, 3 deletions):

```diff
diff --git a/web/src/styles/app.css b/web/src/styles/app.css
index 6168713..55fe085 100644
--- a/web/src/styles/app.css
+++ b/web/src/styles/app.css
@@ -2924,9 +2924,7 @@ body {
     max-width: 560px;
   }
 
-  /* Under `.disposicion`, so it is not beaten by `.disposicion .pantalla { padding: 0 }`
-   * (GH-77): the shell owns the insets, this is the screen's own 80px. */
-  .disposicion .ajustes-grupo {
+  .ajustes-grupo {
     align-items: center;
     padding-top: 80px;
   }
```

Diff stats: `git diff fe7bdef..HEAD --stat` on this branch is only `docs/evidence/GH-150-with-without.md`; there is no `app.css` or `insets.spec.ts` change, because both are already on master.

## Captures

Four unmodified `scripts/design/compare.sh` runs over all 127 screens of `scripts/design/screens.json` (two per side, with-1/without-1 first, with-2/without-2 second). Load average and `pgrep` are recorded for information only; nothing waited on them.

| Run | Side | Started | Finished | loadavg at start |
| --- | --- | --- | --- | --- |
| 1 | with | 2026-10-16T03:17 | 2026-10-16T03:39 | 48.16 35.23 24.05 |
| 2 | without | 2026-10-16T03:40:54 | 2026-10-16T04:03:13 | 46.50 57.49 54.20 |
| 3 | with | 2026-10-16T04:26:55 | 2026-10-16T04:35:19 | 27.64 38.46 55.72 |
| 4 | without | 2026-10-16T04:35:23 | 2026-10-16T04:51:17 | 11.43 19.96 40.11 |

Every run exited 0 and wrote 127 screens, each with a `design` and a `built` PNG. Four screens logged a step or font failure in all four runs, on both sides alike: `OnboardingListo` and `EstadosConfirmar` (a click not reached in 8 s) and `EstadosSinConexionCompu` and `EstadosSinConexionCompuOscuro` (a page font in error). Earlier attempts to start the second "with" run died on the sample app's 120 s readiness limit at load average 94 to 97; they wrote nothing and are not counted.

## ae.mjs (exact AE over the raw captures)

`ae.mjs` exits 1 on any difference. Lines other than `AE 0`:

- run 1 vs run 3 (with, within side):
```
EntradaStockEditar built: FAIL different dimensions
Analisis built: FAIL different dimensions
EstadosSinConexion built: AE 176626
EstadosSinConexionCompu built: AE 381097
VariedadArchivadaOscuro built: AE 148549
ae: the before/after differ, or could not be compared
```
- run 2 vs run 4 (without, within side):
```
VariedadesCompu built: FAIL different dimensions
VariedadDetalle built: FAIL different dimensions
EstadosSinConexionOscuro built: AE 196911
EstadosSinConexionCompuOscuro built: AE 381649
VariedadArchivadaOscuro built: AE 20214
ae: the before/after differ, or could not be compared
```
- run 1 vs run 2 (with vs without, first captures):
```
EntradaStockEditar built: FAIL different dimensions
VariedadDetalle built: FAIL different dimensions
Analisis built: FAIL different dimensions
ConfiguracionNegocioCompu built: AE 331045
ConfiguracionUsuariosCompu built: AE 224279
ConfiguracionPreciosCompu built: AE 267590
ConfiguracionIntegracionesCompu built: AE 597191
ConfiguracionIntegracionesCompuOscuro built: AE 597778
ConfiguracionMensajeCompu built: AE 547404
ConfiguracionCategoriasCompu built: AE 411087
ConfiguracionAparienciaCompu built: AE 134497
ConfiguracionCuentaCompu built: AE 256431
EstadosSinConexion built: AE 176626
EstadosSinConexionCompu built: AE 381097
EstadosSinConexionOscuro built: AE 196911
EstadosSinConexionCompuOscuro built: AE 381649
VariedadArchivada built: AE 141624
VariedadArchivadaOscuro built: AE 152580
ae: the before/after differ, or could not be compared
```
- run 3 vs run 4 (with vs without, second captures):
```
VariedadesCompu built: FAIL different dimensions
ConfiguracionNegocioCompu built: AE 331045
ConfiguracionUsuariosCompu built: AE 224279
ConfiguracionPreciosCompu built: AE 267590
ConfiguracionIntegracionesCompu built: AE 597191
ConfiguracionIntegracionesCompuOscuro built: AE 597778
ConfiguracionMensajeCompu built: AE 547404
ConfiguracionCategoriasCompu built: AE 411087
ConfiguracionAparienciaCompu built: AE 134497
ConfiguracionCuentaCompu built: AE 256431
VariedadArchivada built: AE 141624
ae: the before/after differ, or could not be compared
```

## Result

All 127 `design` hashes are identical across the four runs, so the two sides were captured with the same setup. Of the 127 screens:

- **9 differ across the sides and are stable within each side (fix-driven):** `ConfiguracionNegocioCompu`, `ConfiguracionUsuariosCompu`, `ConfiguracionPreciosCompu`, `ConfiguracionIntegracionesCompu`, `ConfiguracionIntegracionesCompuOscuro`, `ConfiguracionMensajeCompu`, `ConfiguracionCategoriasCompu`, `ConfiguracionAparienciaCompu`, `ConfiguracionCuentaCompu`. Reason: each is drawn by `SettingsGroup` at the computer viewport (1280 px wide, inside `@media (min-width: 900px)`), and without the hunk GH-77's `.disposicion .pantalla { padding: 0 }` beats `.ajustes-grupo` and removes the group card's 80 px top padding; with it the card regains 80 px. AE with vs without: 134497 to 597778 px per screen, the same value in both pairs of runs. `ConfiguracionIntegracionesCompuOscuro` is the dark twin of `ConfiguracionIntegracionesCompu` and has the same cause.
- **1 differs across the sides, stable within each side, and is not fix-driven: `VariedadArchivada`.** It is a phone screen, so the hunk (inside `min-width: 900px`) cannot reach it. In both "without" runs the built half shows the page's loading skeleton (grey placeholder bars, no title or rows); in both "with" runs it shows the loaded screen (Sir Jack, Restaurar, Stock y entradas). Two further `--only VariedadArchivada,...` captures per side (extra runs, load average 39 to 46) gave `104126f05994...` on both sides, i.e. the same hash with and without. The cause is the capture catching a loading state, not the CSS.
- **9 are unstable within a side but share a hash across the sides, so they are not differences:** `Analisis` and `EntradaStockEditar` (with side only: a different page height between runs), `EstadosSinConexion` (with only), `EstadosSinConexionOscuro`, `EstadosSinConexionCompuOscuro` and `VariedadDetalle` (without only), `EstadosSinConexionCompu` (with only), `VariedadesCompu` (without only), and `VariedadArchivadaOscuro` (both sides, a different hash in nearly every capture). Cause: app state at the moment of capture (page height and loading state of the built half, and the offline screens with a page font in error), the same screens, with and without the hunk. Evidence: `--only Analisis,EntradaStockEditar,VariedadDetalle,...` reruns gave a single hash per screen on both sides, equal across the sides (`Analisis` `8bf2a82b20ac`, `EntradaStockEditar` `c3db8a1b34ae`, `VariedadDetalle` `445c09de4772`).
- **108 are identical** (the same `design` and `built` hash in all four runs).

## Guard: `web/e2e/insets.spec.ts` run alone on the without side

Command, in the scratch clone at `279af14`: `npm --prefix web run e2e -- insets.spec.ts` (own log: `/tmp/gh150r/insets-without.txt`). The notch test passed; the new settings-group test failed, which also shows the spec was present on that side:

```
> apostrophe-web@0.0.0 e2e
> sh scripts/e2e.sh insets.spec.ts
vite v8.3.2 building client environment for production...
transforming...
✓ 346 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                                       0.95 kB │ gzip:   0.43 kB
dist/assets/plus-jakarta-sans-vietnamese-400-normal-Cg2kxhWu.woff2    4.09 kB
dist/assets/plus-jakarta-sans-vietnamese-600-normal-Y4VTTRme.woff2    4.19 kB
dist/assets/plus-jakarta-sans-vietnamese-700-normal-CV6qDkkj.woff2    4.26 kB
dist/assets/plus-jakarta-sans-vietnamese-500-normal-DiU8zqi-.woff2    4.28 kB
dist/assets/plus-jakarta-sans-vietnamese-400-normal-B8TCSmUq.woff     5.59 kB
dist/assets/plus-jakarta-sans-vietnamese-600-normal-5YsyKbU1.woff     5.74 kB
dist/assets/plus-jakarta-sans-vietnamese-700-normal-BCh_uG_5.woff     5.77 kB
dist/assets/plus-jakarta-sans-vietnamese-500-normal-CvE5C8T-.woff     5.78 kB
dist/assets/plus-jakarta-sans-latin-ext-400-normal-D127hM_v.woff2    10.59 kB
dist/assets/plus-jakarta-sans-latin-ext-500-normal-9VZagAe1.woff2    10.86 kB
dist/assets/plus-jakarta-sans-latin-ext-600-normal-DQgPU_Cg.woff2    10.89 kB
dist/assets/plus-jakarta-sans-latin-ext-700-normal-BajbvANd.woff2    11.00 kB
dist/assets/plus-jakarta-sans-latin-400-normal-Dhut76fR.woff2        11.81 kB
dist/assets/plus-jakarta-sans-latin-600-normal-DLTa1BUW.woff2        12.18 kB
dist/assets/plus-jakarta-sans-latin-700-normal-CfpNZvy6.woff2        12.24 kB
dist/assets/plus-jakarta-sans-latin-500-normal-Bf-nb4oT.woff2        12.31 kB
dist/assets/plus-jakarta-sans-latin-ext-400-normal-2ppkqaOR.woff     15.31 kB
dist/assets/plus-jakarta-sans-latin-ext-600-normal-B0WRRYJ1.woff     15.60 kB
dist/assets/plus-jakarta-sans-latin-ext-700-normal-8-d-IyIQ.woff     15.61 kB
dist/assets/plus-jakarta-sans-latin-ext-500-normal-CqEEAICU.woff     15.62 kB
dist/assets/plus-jakarta-sans-latin-400-normal-BDKaGhyp.woff         15.72 kB
dist/assets/plus-jakarta-sans-latin-600-normal-BR_Ojra4.woff         16.08 kB
dist/assets/plus-jakarta-sans-latin-500-normal-DYtqi0QS.woff         16.12 kB
dist/assets/plus-jakarta-sans-latin-700-normal-DqEcQeE5.woff         16.13 kB
dist/assets/index-XTi-nVHY.css                                       82.55 kB │ gzip:  20.59 kB
dist/assets/index-C1Y1KjPj.js                                       602.10 kB │ gzip: 171.40 kB
[plugin builtin:vite-reporter] 
(!
```

(`No tests found` is the `timed` project, which has no test in this spec.)

## #101 record

Comments 6179162045 and 6180452261 on #101 already say that only run 4 of EntrarOscuro matches the before runs (run 2's built PNG, `4f078c...`, also differs), and the first judgement comment 6046318381 already reads "runs 2 and 6 (`EntrarOscuro`)" and "run 4" in its correction note (edited 2026-10-15). That correction rests on #101's old runs (its artifacts are gone) and is left as is.

## Per screen, all 127 (SHA-256 of the raw PNGs; `a` / `b` when the first and second capture of that side differ)

| Screen | with design | with built | without design | without built | Class |
| --- | --- | --- | --- | --- | --- |
| `Analisis` | `3fdbf2f5573aed7d43e65aa58923b809614cd69c28dd6201c4ec5f9bbd99a4e5` | `febe013657c88d9eff61257fc5ddb4aec01fbe21674563abdc783da9f190aa0e` / `2c03fe4ba9bc8c539ade0922515deaebf71a52965da052fc7b84481521957252` | `3fdbf2f5573aed7d43e65aa58923b809614cd69c28dd6201c4ec5f9bbd99a4e5` | `2c03fe4ba9bc8c539ade0922515deaebf71a52965da052fc7b84481521957252` | unstable within a side (shares a hash across sides) |
| `AnalisisCompu` | `66d5504b16f2cb213adbfd75974740974667072d00e8713cecc069e182bbf705` | `946e14b92b7c92895ceb923c508e586c74a09bb0bf21b99cbaa4d622476174e1` | `66d5504b16f2cb213adbfd75974740974667072d00e8713cecc069e182bbf705` | `946e14b92b7c92895ceb923c508e586c74a09bb0bf21b99cbaa4d622476174e1` | identical |
| `AnalisisCompuOscuro` | `66d5504b16f2cb213adbfd75974740974667072d00e8713cecc069e182bbf705` | `3eb98efaff59bbaf81a9085485689640147469014ba2089f9efe3e894cd05d77` | `66d5504b16f2cb213adbfd75974740974667072d00e8713cecc069e182bbf705` | `3eb98efaff59bbaf81a9085485689640147469014ba2089f9efe3e894cd05d77` | identical |
| `AnalisisOscuro` | `3fdbf2f5573aed7d43e65aa58923b809614cd69c28dd6201c4ec5f9bbd99a4e5` | `091dc3776c014ba0605bc5ab065e142a9d9ba5b03eb6329ee64ebaf96e8deed4` | `3fdbf2f5573aed7d43e65aa58923b809614cd69c28dd6201c4ec5f9bbd99a4e5` | `091dc3776c014ba0605bc5ab065e142a9d9ba5b03eb6329ee64ebaf96e8deed4` | identical |
| `Archivadas` | `bb2cce777081d15893928b36c0294f1b54ed277a2f9dafe83cd39103b2e2849b` | `b51a6851de0c9f455b91881a65b8638695792b89e0c2c6c4ef7322b357d6ca22` | `bb2cce777081d15893928b36c0294f1b54ed277a2f9dafe83cd39103b2e2849b` | `b51a6851de0c9f455b91881a65b8638695792b89e0c2c6c4ef7322b357d6ca22` | identical |
| `ArchivadasOscuro` | `bb2cce777081d15893928b36c0294f1b54ed277a2f9dafe83cd39103b2e2849b` | `6bbf0398d6d691f804b737ac40729be08913970e5e46885c7452a463a53cfd3b` | `bb2cce777081d15893928b36c0294f1b54ed277a2f9dafe83cd39103b2e2849b` | `6bbf0398d6d691f804b737ac40729be08913970e5e46885c7452a463a53cfd3b` | identical |
| `Catalogo` | `6e6cd36a3864cf7a4b89955addb8a801757868ba3fe8781cae4ef0d9d041a4d4` | `717b6737213e446f5b9dde0893f4bae9c9fa62fe14879e63510de61332833a42` | `6e6cd36a3864cf7a4b89955addb8a801757868ba3fe8781cae4ef0d9d041a4d4` | `717b6737213e446f5b9dde0893f4bae9c9fa62fe14879e63510de61332833a42` | identical |
| `CatalogoCompu` | `fbf9d778be7682f710d98327c88853fd86ed3774ffcc8ec7110b57242841deb6` | `db7a3ad51602c996268adf474820ac09f8befe6a584b09021e53bb5503539223` | `fbf9d778be7682f710d98327c88853fd86ed3774ffcc8ec7110b57242841deb6` | `db7a3ad51602c996268adf474820ac09f8befe6a584b09021e53bb5503539223` | identical |
| `CatalogoCompuOscuro` | `fbf9d778be7682f710d98327c88853fd86ed3774ffcc8ec7110b57242841deb6` | `5467a63d9de3d57254a2ed683be1a5f95b2dd53584a5e85df8bb453ecb75ebb5` | `fbf9d778be7682f710d98327c88853fd86ed3774ffcc8ec7110b57242841deb6` | `5467a63d9de3d57254a2ed683be1a5f95b2dd53584a5e85df8bb453ecb75ebb5` | identical |
| `CatalogoOscuro` | `6e6cd36a3864cf7a4b89955addb8a801757868ba3fe8781cae4ef0d9d041a4d4` | `04d6224c66d4eefe86217928eb0e049509aaef78b4be3e6450134c85bf64aa40` | `6e6cd36a3864cf7a4b89955addb8a801757868ba3fe8781cae4ef0d9d041a4d4` | `04d6224c66d4eefe86217928eb0e049509aaef78b4be3e6450134c85bf64aa40` | identical |
| `ClienteEditar` | `9f1967789a9408d21bcc870feb749f994d04271be061c44e5777747bac6586cb` | `c7d8c08c84430fa64395d911af2d02470916bb1f77f356ae21c93d564831ded8` | `9f1967789a9408d21bcc870feb749f994d04271be061c44e5777747bac6586cb` | `c7d8c08c84430fa64395d911af2d02470916bb1f77f356ae21c93d564831ded8` | identical |
| `ClienteEditarCompu` | `9f1967789a9408d21bcc870feb749f994d04271be061c44e5777747bac6586cb` | `77ad7877549be6fad035d0995b513b2344f7f387106e1166af27632086b5b636` | `9f1967789a9408d21bcc870feb749f994d04271be061c44e5777747bac6586cb` | `77ad7877549be6fad035d0995b513b2344f7f387106e1166af27632086b5b636` | identical |
| `ClienteFicha` | `48fd182332f69c0387861953b85c3ab6060362ade09823e70636e9354c4651fa` | `9d73f2c030c95125f5e34383f2fab0bbb4d3e9e09cdb29276463fb1ea3ba14a4` | `48fd182332f69c0387861953b85c3ab6060362ade09823e70636e9354c4651fa` | `9d73f2c030c95125f5e34383f2fab0bbb4d3e9e09cdb29276463fb1ea3ba14a4` | identical |
| `ClienteNuevo` | `9f1967789a9408d21bcc870feb749f994d04271be061c44e5777747bac6586cb` | `df7737aece3674b76f6786611d731150b309f26a512afb0e7491eaa66821e9c0` | `9f1967789a9408d21bcc870feb749f994d04271be061c44e5777747bac6586cb` | `df7737aece3674b76f6786611d731150b309f26a512afb0e7491eaa66821e9c0` | identical |
| `ClienteNuevoCompu` | `9f1967789a9408d21bcc870feb749f994d04271be061c44e5777747bac6586cb` | `b32fd3900d972dbc9af07b89bc8e4aacc727b7d76dd45d1079b5c7527a7bffe8` | `9f1967789a9408d21bcc870feb749f994d04271be061c44e5777747bac6586cb` | `b32fd3900d972dbc9af07b89bc8e4aacc727b7d76dd45d1079b5c7527a7bffe8` | identical |
| `Clientes` | `7bc5ba9c67cc85cdae8e79b5f5fba65ef0b757f412691ea5391e3f3339be3d31` | `f7a4c891139f9008466197fa4bc125207808121d9c0dffa773ff0357ef6fef52` | `7bc5ba9c67cc85cdae8e79b5f5fba65ef0b757f412691ea5391e3f3339be3d31` | `f7a4c891139f9008466197fa4bc125207808121d9c0dffa773ff0357ef6fef52` | identical |
| `ClientesCompu` | `9a36ecca29f11c2705ff02d8a046612393af8867ce192ebdd6a155ec1f1fbcc5` | `e0add0492228b498eef89653b595e43cf16c4aab586c1e66a99e8bb2913a9c3b` | `9a36ecca29f11c2705ff02d8a046612393af8867ce192ebdd6a155ec1f1fbcc5` | `e0add0492228b498eef89653b595e43cf16c4aab586c1e66a99e8bb2913a9c3b` | identical |
| `Cobro` | `65f4377c45163f6aba565af37389ac744fabeda3a9c2abd735cb7b7c50b41acd` | `0222346285d267d1725c6e5f22e48ef002fcc151372967e37dc5166688e35987` | `65f4377c45163f6aba565af37389ac744fabeda3a9c2abd735cb7b7c50b41acd` | `0222346285d267d1725c6e5f22e48ef002fcc151372967e37dc5166688e35987` | identical |
| `CobroCompu` | `6221c59dfde625d04fcf42cab2ad5604769659abc665b14c3b1f065234672c6b` | `03e640ba943e2a291de1f35c7c84be60104789b54b0718421df09427a68adbf8` | `6221c59dfde625d04fcf42cab2ad5604769659abc665b14c3b1f065234672c6b` | `03e640ba943e2a291de1f35c7c84be60104789b54b0718421df09427a68adbf8` | identical |
| `Configuracion` | `1408691a623fd2de8b297da719f88c242249ea965a10bf404c6ce41df0f8a6af` | `1c42a3af36b27f3d3de635c83908069dfc02727b3f8f4771785bc3b516c93556` | `1408691a623fd2de8b297da719f88c242249ea965a10bf404c6ce41df0f8a6af` | `1c42a3af36b27f3d3de635c83908069dfc02727b3f8f4771785bc3b516c93556` | identical |
| `ConfiguracionApariencia` | `a1701d1d0bc2790e377c205e8d7304d18df1ac2a117eddee1f3aaebbead6d9e8` | `8400a900e2cc3adabca0bdd442e7d34c909c40ca263867a9fbba04fc928359b1` | `a1701d1d0bc2790e377c205e8d7304d18df1ac2a117eddee1f3aaebbead6d9e8` | `8400a900e2cc3adabca0bdd442e7d34c909c40ca263867a9fbba04fc928359b1` | identical |
| `ConfiguracionAparienciaCompu` | `648365b49076f09e8a648cb1ca0a4e94805a5c695267a8f0935e218cb1605e99` | `b0cc61643899b3af66451eec5cc974ad88465b37039cc44ddab22344538313e0` | `648365b49076f09e8a648cb1ca0a4e94805a5c695267a8f0935e218cb1605e99` | `a0f5db6f1e8f645efc18bdabf8267541881520f1e9a5db20362587fb224202d4` | differs, fix-driven |
| `ConfiguracionCategorias` | `f58079d05eeae652c84e8095da7bb3213c7b33652f9be4ef164ce073f399c02a` | `9455a790b8f7359f168ed6bba5f454428a58df35ed930998f808d76d883d4c38` | `f58079d05eeae652c84e8095da7bb3213c7b33652f9be4ef164ce073f399c02a` | `9455a790b8f7359f168ed6bba5f454428a58df35ed930998f808d76d883d4c38` | identical |
| `ConfiguracionCategoriasCompu` | `53c630abe1da5174b32c6ffeef1f447850f54d9ae13cb412f21acf8c3a1625ad` | `71fb9ddeb4874963c1a602cbfb8f48a79ac66a605ab91b26cf64a2609e249ab2` | `53c630abe1da5174b32c6ffeef1f447850f54d9ae13cb412f21acf8c3a1625ad` | `879830f8d24d06675176e31c52546b5a633550434ba530698854e2dfb58944ba` | differs, fix-driven |
| `ConfiguracionCompu` | `43dcc6ab9968cc8a2a8e164da9c94e83cdc9df0009158e75d9536c8450516482` | `f1498a2b01541689e41257b2cc9920092c41fe3b0ce1724cc45c928ec9cc6d07` | `43dcc6ab9968cc8a2a8e164da9c94e83cdc9df0009158e75d9536c8450516482` | `f1498a2b01541689e41257b2cc9920092c41fe3b0ce1724cc45c928ec9cc6d07` | identical |
| `ConfiguracionCuenta` | `f5fbd870355ce18b2ac61668c587c4f60bd76c7c7de46f663aa7f6aeb45fdf1f` | `9a3e4e596b58b04f42bdc318a7a920c684f4d4dc26fab904ab1d33323f6f909f` | `f5fbd870355ce18b2ac61668c587c4f60bd76c7c7de46f663aa7f6aeb45fdf1f` | `9a3e4e596b58b04f42bdc318a7a920c684f4d4dc26fab904ab1d33323f6f909f` | identical |
| `ConfiguracionCuentaCompu` | `51b55928d2e392f0e7dc5305f67b6ee91b0439538f61e629dcb3fc29f812a8ac` | `59d2be46fa2c44fc386fed82d46d19ffe1deae0e33dcd2a7a36553ad3dca823b` | `51b55928d2e392f0e7dc5305f67b6ee91b0439538f61e629dcb3fc29f812a8ac` | `aafc68797c9dff12ee7a67142efcee4b998debdb025119ef2fb3fb2b0f98c844` | differs, fix-driven |
| `ConfiguracionIntegraciones` | `d0698bcce8dd2d44e138ffa9470d9cc79fb277a5f45e1ba7767402bac05d4e46` | `7000d59e492813a816d15fd7566990676e2350e10ee5457992a2060a48e700fe` | `d0698bcce8dd2d44e138ffa9470d9cc79fb277a5f45e1ba7767402bac05d4e46` | `7000d59e492813a816d15fd7566990676e2350e10ee5457992a2060a48e700fe` | identical |
| `ConfiguracionIntegracionesCompu` | `e26077931b31b11736b033240d4d7e1029b346a90e4c96c252d4262761db48a1` | `aae4a116e1259efb4eada38d1eb275ba27c17d2cee4b37aca07179ab225fba3b` | `e26077931b31b11736b033240d4d7e1029b346a90e4c96c252d4262761db48a1` | `11cb055094da22ffe46b9978d018e6f67ee631bac8a7f596c4fcd3974279e859` | differs, fix-driven |
| `ConfiguracionIntegracionesCompuOscuro` | `e26077931b31b11736b033240d4d7e1029b346a90e4c96c252d4262761db48a1` | `f1645e2a4bf61ccd67d7f0491f84da5d199d905c57467b91e9450c523fe4a963` | `e26077931b31b11736b033240d4d7e1029b346a90e4c96c252d4262761db48a1` | `e2902942ee3b30a396c95e77ac30b80d42edb64264617180432a386e9827916c` | differs, fix-driven |
| `ConfiguracionIntegracionesOscuro` | `d0698bcce8dd2d44e138ffa9470d9cc79fb277a5f45e1ba7767402bac05d4e46` | `c3fcee1dc240c6b3880279c0d13aca0219494319a189513d66ac771ce1741991` | `d0698bcce8dd2d44e138ffa9470d9cc79fb277a5f45e1ba7767402bac05d4e46` | `c3fcee1dc240c6b3880279c0d13aca0219494319a189513d66ac771ce1741991` | identical |
| `ConfiguracionMensaje` | `66aa8382a51c7b5d12d72b0d42d5465885e71986c6b9de26f18d770f6fff4c59` | `dd3dac6ac29c9161603d3cca2268d5fba1268af4259e797bfda2ec66dd5b0d38` | `66aa8382a51c7b5d12d72b0d42d5465885e71986c6b9de26f18d770f6fff4c59` | `dd3dac6ac29c9161603d3cca2268d5fba1268af4259e797bfda2ec66dd5b0d38` | identical |
| `ConfiguracionMensajeCompu` | `21ce3f762c2aa30e0cd6e3bacfde15a960bbdc86d547f07208b8b0760263a613` | `d32c4055ae4dbb739f081ea2c9ba2d814271f95fdb7122ab56fefb529185c523` | `21ce3f762c2aa30e0cd6e3bacfde15a960bbdc86d547f07208b8b0760263a613` | `a06f49f5fcb4ad09ce9c1f676c647ede40be94c2160182ff4c0c7fb2f9f32039` | differs, fix-driven |
| `ConfiguracionNegocio` | `b50760a5b6ca97402d00e552381a7f2af7e29d05b0a2dd7bc092630cd88fb2e4` | `ea8f026ee62298d7779f496d69fa58e6425c5c6c12b82cbb6f31d28f1d5f3a9b` | `b50760a5b6ca97402d00e552381a7f2af7e29d05b0a2dd7bc092630cd88fb2e4` | `ea8f026ee62298d7779f496d69fa58e6425c5c6c12b82cbb6f31d28f1d5f3a9b` | identical |
| `ConfiguracionNegocioCompu` | `ecf703d6a095e9aefa8e24095a485eec501447d43bcdc32611adb3bb1799f081` | `11f9d1889c9ffba77d29b66fa0038a3e6158449f9ed36bbf84b6b44ceec506de` | `ecf703d6a095e9aefa8e24095a485eec501447d43bcdc32611adb3bb1799f081` | `587ccd565b5df6100d46a3881b2fb1bcffe461a860e4159438aff50d1cedb612` | differs, fix-driven |
| `ConfiguracionPrecios` | `70da657f115693ffa27ccf1f553235d0645a010295567b19bef98016e63782cd` | `19da56a60c45d79447f18b461c7cf77e965f7469b1eb09f3f6da7a4e60160b2c` | `70da657f115693ffa27ccf1f553235d0645a010295567b19bef98016e63782cd` | `19da56a60c45d79447f18b461c7cf77e965f7469b1eb09f3f6da7a4e60160b2c` | identical |
| `ConfiguracionPreciosCompu` | `520c2e9311ff13a48c2878078ab888b4c968bf1f110846b617ef8e2601ae7da1` | `b2383ebbcfc93a1a977742cdc8fbb03da865e62f45d2bfa2347f0f7eb14d0bc5` | `520c2e9311ff13a48c2878078ab888b4c968bf1f110846b617ef8e2601ae7da1` | `a317f7dfc68d0ecb6d81e0b244afe31d1b0400608a1095db85a2d3e3cc0bd864` | differs, fix-driven |
| `ConfiguracionUsuarios` | `1511f6bcbe2736dfa6f5565ee346b28fdad7ceae68ac067948958daaf0d36da1` | `173cd218d8d5bb9dd723e75af4099a2e6ce98d5b99eb4a560b35dcf9e2db85c7` | `1511f6bcbe2736dfa6f5565ee346b28fdad7ceae68ac067948958daaf0d36da1` | `173cd218d8d5bb9dd723e75af4099a2e6ce98d5b99eb4a560b35dcf9e2db85c7` | identical |
| `ConfiguracionUsuariosCompu` | `3cb6d283388072eb872329ca3bfe0b3d404418061d6f2f2ce0b91baf01cc5518` | `a6a3447df2f9eb5f653216b2c7d2c1e81dc0062fea142aa298bc372f00c3273e` | `3cb6d283388072eb872329ca3bfe0b3d404418061d6f2f2ce0b91baf01cc5518` | `96c201c0888f9eb369932f567505c08f4fb0f3507c541b6d96a136efaf2d1f07` | differs, fix-driven |
| `EntradaStock` | `3161c51fd6b825c8168e3b83dd789e717657f12907ba7acfe6fc78360b1d64e0` | `b3777aea0a5cac7bef94a65e880ca0e99fc6115f6210391374e783576aa1c060` | `3161c51fd6b825c8168e3b83dd789e717657f12907ba7acfe6fc78360b1d64e0` | `b3777aea0a5cac7bef94a65e880ca0e99fc6115f6210391374e783576aa1c060` | identical |
| `EntradaStockCompu` | `dd9fce8bcd75d6f62df51c907782d8a42e20d6250aa573d3461fbadcc489e50c` | `10d0f1715838bf698eed8786110fb2317770dc99589fadb55dfc2305a433dfa8` | `dd9fce8bcd75d6f62df51c907782d8a42e20d6250aa573d3461fbadcc489e50c` | `10d0f1715838bf698eed8786110fb2317770dc99589fadb55dfc2305a433dfa8` | identical |
| `EntradaStockEditar` | `3161c51fd6b825c8168e3b83dd789e717657f12907ba7acfe6fc78360b1d64e0` | `b59d4fc8fd58633e7693710591c9aab0f3522b292a3d43eb20709657402adc21` / `88c1c1777fec27d72d45d18878bc54cddaf767ae48134c0465a83d9c22e1e057` | `3161c51fd6b825c8168e3b83dd789e717657f12907ba7acfe6fc78360b1d64e0` | `88c1c1777fec27d72d45d18878bc54cddaf767ae48134c0465a83d9c22e1e057` | unstable within a side (shares a hash across sides) |
| `Entrar` | `97b0afb596f0029fef1787fde817c801e6bb05274ef535ec923cc54c07356ff3` | `5bb8145b28e87f23454d7af037a8418707077a16eec655e07b50b9fa0e731c74` | `97b0afb596f0029fef1787fde817c801e6bb05274ef535ec923cc54c07356ff3` | `5bb8145b28e87f23454d7af037a8418707077a16eec655e07b50b9fa0e731c74` | identical |
| `EntrarOscuro` | `97b0afb596f0029fef1787fde817c801e6bb05274ef535ec923cc54c07356ff3` | `fef669e30dd16ba9a884685ab084cb82a87492e01578adda87d87832e3d941f8` | `97b0afb596f0029fef1787fde817c801e6bb05274ef535ec923cc54c07356ff3` | `fef669e30dd16ba9a884685ab084cb82a87492e01578adda87d87832e3d941f8` | identical |
| `EstadosConfirmar` | `2a9e816fda0a7aca616ca79defef55dc98097cc98dc76322e171a48d323e1421` | `5f7eb9adc19bc42aac96e92d21adfae6432fc18b723657b6240fa11cf63100b9` | `2a9e816fda0a7aca616ca79defef55dc98097cc98dc76322e171a48d323e1421` | `5f7eb9adc19bc42aac96e92d21adfae6432fc18b723657b6240fa11cf63100b9` | identical |
| `EstadosGone` | `0238d2b451c724a6f255339b6260ad7ee22196f9dd67a8716df52a5ab7281fe4` | `4708c01396de8d60ee4cdc0dd49bdd2826ac5befed4042d758840e6a94ef0c7a` | `0238d2b451c724a6f255339b6260ad7ee22196f9dd67a8716df52a5ab7281fe4` | `4708c01396de8d60ee4cdc0dd49bdd2826ac5befed4042d758840e6a94ef0c7a` | identical |
| `EstadosSinConexion` | `be707e3f7057b14bd4d195cfa571fef6ac53bb2b6839563e869c39dc37cd65aa` | `142df3a526650500262c74966ac5e3599da71d18fc6b801f42fc7b7402d4f5b8` / `254fa91fd8b58ea82e8b909213768fdd61efdfed3b587322e69b49df67b4f81e` | `be707e3f7057b14bd4d195cfa571fef6ac53bb2b6839563e869c39dc37cd65aa` | `254fa91fd8b58ea82e8b909213768fdd61efdfed3b587322e69b49df67b4f81e` | unstable within a side (shares a hash across sides) |
| `EstadosSinConexionCompu` | `be707e3f7057b14bd4d195cfa571fef6ac53bb2b6839563e869c39dc37cd65aa` | `91dac8944193ef3c8330bfe433c2055ed175242d514537c908c952146b8bd249` / `980bea44fcb54ca4c4cda75d7c2e18496e3362e117c7e422f51c67155fd9cc0b` | `be707e3f7057b14bd4d195cfa571fef6ac53bb2b6839563e869c39dc37cd65aa` | `980bea44fcb54ca4c4cda75d7c2e18496e3362e117c7e422f51c67155fd9cc0b` | unstable within a side (shares a hash across sides) |
| `EstadosSinConexionCompuOscuro` | `be707e3f7057b14bd4d195cfa571fef6ac53bb2b6839563e869c39dc37cd65aa` | `c4480f229c736c88d6866895a9eb27d3e7692a1376f21cad9ecba86ec0920bb7` | `be707e3f7057b14bd4d195cfa571fef6ac53bb2b6839563e869c39dc37cd65aa` | `e87ccaead8e072d9218cb7b5fe1f2cc379bcb11bf2ae72846a5cc95aff1a632a` / `c4480f229c736c88d6866895a9eb27d3e7692a1376f21cad9ecba86ec0920bb7` | unstable within a side (shares a hash across sides) |
| `EstadosSinConexionOscuro` | `be707e3f7057b14bd4d195cfa571fef6ac53bb2b6839563e869c39dc37cd65aa` | `ec99de4034a6ae6ea8b8543f4eae5bc5500ebc88cd7e553219e0a2014db3a56b` | `be707e3f7057b14bd4d195cfa571fef6ac53bb2b6839563e869c39dc37cd65aa` | `e65e8c9a942317a0771138baf7c768cae932acf0d3455e6a474a64a393421c59` / `ec99de4034a6ae6ea8b8543f4eae5bc5500ebc88cd7e553219e0a2014db3a56b` | unstable within a side (shares a hash across sides) |
| `GastoNuevo` | `444e238cf615a2d02f52d89892d6b58bf2542a9daf3ccd181a5b3236b3171e7d` | `129ab4ecf086da36dbd17bceae2677297d821e968e3b6329597338e2188285b5` | `444e238cf615a2d02f52d89892d6b58bf2542a9daf3ccd181a5b3236b3171e7d` | `129ab4ecf086da36dbd17bceae2677297d821e968e3b6329597338e2188285b5` | identical |
| `GastoNuevoCompu` | `e1a420f37585fc599802dcc0732a77ccbf8dc4fec7f6a42d29615572f29ad85c` | `657acf5574f6521b21d170ac7069cc2c325bbe38792ca89aba85463b7d7e7576` | `e1a420f37585fc599802dcc0732a77ccbf8dc4fec7f6a42d29615572f29ad85c` | `657acf5574f6521b21d170ac7069cc2c325bbe38792ca89aba85463b7d7e7576` | identical |
| `Gastos` | `ae425dc8d6848403bda7d8241512efd692cd2b2c857b547709c34c59f4065397` | `28ab4f643d6f5d32bbd361a1319a1484ce16f242044a2842ed8a1cad29b72d44` | `ae425dc8d6848403bda7d8241512efd692cd2b2c857b547709c34c59f4065397` | `28ab4f643d6f5d32bbd361a1319a1484ce16f242044a2842ed8a1cad29b72d44` | identical |
| `GastosCompu` | `bb79781941b8e82e5032ac6ad58b4652a9acb817135fd0613da3f40f94882d38` | `76703620e1af3d14e078816e25e668e3a4bbdf3f6da4caf6e4e17cce41946059` | `bb79781941b8e82e5032ac6ad58b4652a9acb817135fd0613da3f40f94882d38` | `76703620e1af3d14e078816e25e668e3a4bbdf3f6da4caf6e4e17cce41946059` | identical |
| `Inicio` | `f97635dddf89e3a0f54fd2b022311389bde2676858b129b2287b6a35e0a362eb` | `d6218ee3e480a0df5e6c9ddc250bb167ed88ebd9d9b71e3133f437ebf9fce317` | `f97635dddf89e3a0f54fd2b022311389bde2676858b129b2287b6a35e0a362eb` | `d6218ee3e480a0df5e6c9ddc250bb167ed88ebd9d9b71e3133f437ebf9fce317` | identical |
| `InicioCompu` | `6e022ee57988e9c3e3f6cabc5d09e4237ecb801d6419cc4a4e4d518b92c363dc` | `50384da10a89fd506ab9ca905388865b057e6c64e220f31d8e19671363b2763b` | `6e022ee57988e9c3e3f6cabc5d09e4237ecb801d6419cc4a4e4d518b92c363dc` | `50384da10a89fd506ab9ca905388865b057e6c64e220f31d8e19671363b2763b` | identical |
| `InicioOscuro` | `4a27ec10085198e6b5b7ac61ec8a4f03b810a758b1b2ef52e5d1d69879cf8c44` | `e4767e761bc75ff0019e1c0c660efe9028895b1cef48d913345d2b78c6b08c20` | `4a27ec10085198e6b5b7ac61ec8a4f03b810a758b1b2ef52e5d1d69879cf8c44` | `e4767e761bc75ff0019e1c0c660efe9028895b1cef48d913345d2b78c6b08c20` | identical |
| `InicioPrimeraVez` | `09d316a44b33a1f5bbfff3dae588220b9f55be9cb172c7250b2a36fbbaac899d` | `7e0284b1e3d28499eea79ad07b7a2f852d326485e918f5b5e2675495d6d5595d` | `09d316a44b33a1f5bbfff3dae588220b9f55be9cb172c7250b2a36fbbaac899d` | `7e0284b1e3d28499eea79ad07b7a2f852d326485e918f5b5e2675495d6d5595d` | identical |
| `InicioPrimeraVezCompu` | `d7a6f6a8068af72ec3930354207805ff7a8bd5675152d51b5b020a75d34b7059` | `5392fa6b6fce29ac1a89da83032709107594c9be5f29708cfc14e8213ca6fda3` | `d7a6f6a8068af72ec3930354207805ff7a8bd5675152d51b5b020a75d34b7059` | `5392fa6b6fce29ac1a89da83032709107594c9be5f29708cfc14e8213ca6fda3` | identical |
| `InicioPrimeraVezOscuro` | `09d316a44b33a1f5bbfff3dae588220b9f55be9cb172c7250b2a36fbbaac899d` | `f93998f47a69344ab643c8babba286ec6db283d55fd77bca08beb8b6bb74109e` | `09d316a44b33a1f5bbfff3dae588220b9f55be9cb172c7250b2a36fbbaac899d` | `f93998f47a69344ab643c8babba286ec6db283d55fd77bca08beb8b6bb74109e` | identical |
| `Invitacion` | `d3467cf69ec3a3f02a7ac9d9e73103db5f62c68f8e4b7691c24fb4e41544e688` | `b1994d3dedfe1fbb39ed94df71bd936bd477a6e7f6b040a46101172af5642370` | `d3467cf69ec3a3f02a7ac9d9e73103db5f62c68f8e4b7691c24fb4e41544e688` | `b1994d3dedfe1fbb39ed94df71bd936bd477a6e7f6b040a46101172af5642370` | identical |
| `Mas` | `2064172c8c9d3d0caa7429c445eb670ec1cf59e45f2d59a9dc764675b6572012` | `ede32eaf9c92fed21a5466cf0ae573d449f4cd00ce32b37ffe7dc78d01e20307` | `2064172c8c9d3d0caa7429c445eb670ec1cf59e45f2d59a9dc764675b6572012` | `ede32eaf9c92fed21a5466cf0ae573d449f4cd00ce32b37ffe7dc78d01e20307` | identical |
| `MasOscuro` | `2064172c8c9d3d0caa7429c445eb670ec1cf59e45f2d59a9dc764675b6572012` | `538b3e2c3386f056b139dfe96bc078553da33b9270550ec28395694e8049e184` | `2064172c8c9d3d0caa7429c445eb670ec1cf59e45f2d59a9dc764675b6572012` | `538b3e2c3386f056b139dfe96bc078553da33b9270550ec28395694e8049e184` | identical |
| `NegocioNuevo` | `58c26960059025e235598680dd33de8069b58271f0fa819806101b864f20864c` | `f438632a01d5b5742eb69b52aceb7c999cc3bceb9605e5a305fa0fbfad3d55f7` | `58c26960059025e235598680dd33de8069b58271f0fa819806101b864f20864c` | `f438632a01d5b5742eb69b52aceb7c999cc3bceb9605e5a305fa0fbfad3d55f7` | identical |
| `NuevaVenta` | `f1257db9f9da0b3f596bad4b53ce2d346a40cedd7ad5d070b0d7f14c46386e0d` | `42dbe53f57111d1f9e12e7bd973bf9af70d0f310a540531bc18cae9035c9c5f4` | `f1257db9f9da0b3f596bad4b53ce2d346a40cedd7ad5d070b0d7f14c46386e0d` | `42dbe53f57111d1f9e12e7bd973bf9af70d0f310a540531bc18cae9035c9c5f4` | identical |
| `NuevaVentaCliente` | `18c7fb46d45e195db13f9ff588ccec376374764a38586fed461d7013dd091fe3` | `060bbba05e8b4d44077f9d518af4668db6eb94f0e4611369f0bc7b922bb788b4` | `18c7fb46d45e195db13f9ff588ccec376374764a38586fed461d7013dd091fe3` | `060bbba05e8b4d44077f9d518af4668db6eb94f0e4611369f0bc7b922bb788b4` | identical |
| `NuevaVentaClienteOscuro` | `18c7fb46d45e195db13f9ff588ccec376374764a38586fed461d7013dd091fe3` | `4b6b81f8a7943e788786168f085d75620de8dd1e9596aecfd1028f2c86a29881` | `18c7fb46d45e195db13f9ff588ccec376374764a38586fed461d7013dd091fe3` | `4b6b81f8a7943e788786168f085d75620de8dd1e9596aecfd1028f2c86a29881` | identical |
| `NuevaVentaCompu` | `0429c374b9c4ce428dfd71b8b66cf4a291142ac1b7089cf0028b5e29c3bad8d4` | `e7ff5e94efaeb20a484ad229e42fec2a807fb1bad543b40949eb4545e4b3f2f0` | `0429c374b9c4ce428dfd71b8b66cf4a291142ac1b7089cf0028b5e29c3bad8d4` | `e7ff5e94efaeb20a484ad229e42fec2a807fb1bad543b40949eb4545e4b3f2f0` | identical |
| `NuevaVentaCompuOscuro` | `0429c374b9c4ce428dfd71b8b66cf4a291142ac1b7089cf0028b5e29c3bad8d4` | `2851531c37cc84d9dd9c554fee7e02c008da3acde2fd9bd6aa8007189b588aec` | `0429c374b9c4ce428dfd71b8b66cf4a291142ac1b7089cf0028b5e29c3bad8d4` | `2851531c37cc84d9dd9c554fee7e02c008da3acde2fd9bd6aa8007189b588aec` | identical |
| `NuevaVentaOscuro` | `f1257db9f9da0b3f596bad4b53ce2d346a40cedd7ad5d070b0d7f14c46386e0d` | `4cc4eba7eb5fe0e0aa84df338a7b5b25ee2dce8b1684fdf2313659c4a2755f18` | `f1257db9f9da0b3f596bad4b53ce2d346a40cedd7ad5d070b0d7f14c46386e0d` | `4cc4eba7eb5fe0e0aa84df338a7b5b25ee2dce8b1684fdf2313659c4a2755f18` | identical |
| `OnboardingBot` | `3a346b4d3fa5bd49f73cdf6c9b47108f624cdbb8c6ab79e4e4030e54e743762d` | `fcf06d9c2890d86546b113675ecadddc577e5440ddf0a6b2873291fde10797dc` | `3a346b4d3fa5bd49f73cdf6c9b47108f624cdbb8c6ab79e4e4030e54e743762d` | `fcf06d9c2890d86546b113675ecadddc577e5440ddf0a6b2873291fde10797dc` | identical |
| `OnboardingBotCompu` | `5b22cfea6699296523ae31128e2b5135404b8fafc8c2007d1d67b821f40532ed` | `8a9fd6d24368c85e5d633461b9ced8eca9cba166cde70f0015d773f249f45c55` | `5b22cfea6699296523ae31128e2b5135404b8fafc8c2007d1d67b821f40532ed` | `8a9fd6d24368c85e5d633461b9ced8eca9cba166cde70f0015d773f249f45c55` | identical |
| `OnboardingBotCompuOscuro` | `5b22cfea6699296523ae31128e2b5135404b8fafc8c2007d1d67b821f40532ed` | `8fc3aeb39e4a405c2b99a43f8f4fb0869ea56030d2807e6fa547c75d5719ac9f` | `5b22cfea6699296523ae31128e2b5135404b8fafc8c2007d1d67b821f40532ed` | `8fc3aeb39e4a405c2b99a43f8f4fb0869ea56030d2807e6fa547c75d5719ac9f` | identical |
| `OnboardingBotOscuro` | `3a346b4d3fa5bd49f73cdf6c9b47108f624cdbb8c6ab79e4e4030e54e743762d` | `473e4f29b5a76ac2882ec5233ea587a6ecabdc3fa4b084198761f4348deb1d3f` | `3a346b4d3fa5bd49f73cdf6c9b47108f624cdbb8c6ab79e4e4030e54e743762d` | `473e4f29b5a76ac2882ec5233ea587a6ecabdc3fa4b084198761f4348deb1d3f` | identical |
| `OnboardingCategorias` | `a2f47b3d3374802004768f4a3a30f99a894ba63fe62f11bd0dadaafec5113738` | `c41200577c3e540f4fd9931cc8c61da46d83e31c7a92c0dd1bed1cc93704ea60` | `a2f47b3d3374802004768f4a3a30f99a894ba63fe62f11bd0dadaafec5113738` | `c41200577c3e540f4fd9931cc8c61da46d83e31c7a92c0dd1bed1cc93704ea60` | identical |
| `OnboardingCategoriasCompu` | `19cbe24462bb20b38ebf32398ea41ae48e30d3e9ca95cbd97306e561ea00d12b` | `15edccbbf229e46403e3190d1f948dcd84fb40cf2fb796ef4634fa496783781f` | `19cbe24462bb20b38ebf32398ea41ae48e30d3e9ca95cbd97306e561ea00d12b` | `15edccbbf229e46403e3190d1f948dcd84fb40cf2fb796ef4634fa496783781f` | identical |
| `OnboardingCategoriasCompuOscuro` | `19cbe24462bb20b38ebf32398ea41ae48e30d3e9ca95cbd97306e561ea00d12b` | `aad9ee0d93b1fb2045680383f2a99cfbe3c1e6e5e9b52a2babdcb005dd4503ce` | `19cbe24462bb20b38ebf32398ea41ae48e30d3e9ca95cbd97306e561ea00d12b` | `aad9ee0d93b1fb2045680383f2a99cfbe3c1e6e5e9b52a2babdcb005dd4503ce` | identical |
| `OnboardingCategoriasOscuro` | `a2f47b3d3374802004768f4a3a30f99a894ba63fe62f11bd0dadaafec5113738` | `9c34a33def0d71282c80abd3ab5010c155964b1f6e7c8d276e5b9f8249bb752c` | `a2f47b3d3374802004768f4a3a30f99a894ba63fe62f11bd0dadaafec5113738` | `9c34a33def0d71282c80abd3ab5010c155964b1f6e7c8d276e5b9f8249bb752c` | identical |
| `OnboardingListo` | `9eab10843c5de492844ec5e08e4ca0d68f6503980aaecf42a5bddd3c17a098b1` | `c41200577c3e540f4fd9931cc8c61da46d83e31c7a92c0dd1bed1cc93704ea60` | `9eab10843c5de492844ec5e08e4ca0d68f6503980aaecf42a5bddd3c17a098b1` | `c41200577c3e540f4fd9931cc8c61da46d83e31c7a92c0dd1bed1cc93704ea60` | identical |
| `OnboardingMensaje` | `a1dae2687c5a99b6bef049a6f405656d45e3c9ac5c8350a82b073e949b94f0a6` | `21b95e8a209b4e9303942c75484492fd1ddf859a000221d7ae08325b9701a4e9` | `a1dae2687c5a99b6bef049a6f405656d45e3c9ac5c8350a82b073e949b94f0a6` | `21b95e8a209b4e9303942c75484492fd1ddf859a000221d7ae08325b9701a4e9` | identical |
| `OnboardingMensajeCompu` | `bc525cc47677676ac07ef12924b416ef3120be74e82955805da894e54496e969` | `77f2259f8d61cfaef354d932debaf86594a08ab5a35c54c1be41bd9b45931cd0` | `bc525cc47677676ac07ef12924b416ef3120be74e82955805da894e54496e969` | `77f2259f8d61cfaef354d932debaf86594a08ab5a35c54c1be41bd9b45931cd0` | identical |
| `OnboardingMensajeCompuOscuro` | `bc525cc47677676ac07ef12924b416ef3120be74e82955805da894e54496e969` | `7b24de47351491747dad53d8ce440136be56db771a0228c0616e25bb9ebdf111` | `bc525cc47677676ac07ef12924b416ef3120be74e82955805da894e54496e969` | `7b24de47351491747dad53d8ce440136be56db771a0228c0616e25bb9ebdf111` | identical |
| `OnboardingMensajeOscuro` | `a1dae2687c5a99b6bef049a6f405656d45e3c9ac5c8350a82b073e949b94f0a6` | `658a1be4921edda9ab6deb82de3574a490043cfea238bee44217768b91298145` | `a1dae2687c5a99b6bef049a6f405656d45e3c9ac5c8350a82b073e949b94f0a6` | `658a1be4921edda9ab6deb82de3574a490043cfea238bee44217768b91298145` | identical |
| `OnboardingSocio` | `d3e5b78ffc6a400f08f8e0dae22828b240d56f09c559632aafb26a4a17034b2d` | `8397053aa7d9777f73a398229742c639e668794e46280d898d268c029efb9d74` | `d3e5b78ffc6a400f08f8e0dae22828b240d56f09c559632aafb26a4a17034b2d` | `8397053aa7d9777f73a398229742c639e668794e46280d898d268c029efb9d74` | identical |
| `OnboardingSocioCompu` | `e8060e971578b62d13bcb81dc889ad4f0617a8dcdb38bd16387c38ec70b9f451` | `267b5d6506caa0b4e8d768db0beef70285fc0ae2693a1d0d608a0d0567377bcb` | `e8060e971578b62d13bcb81dc889ad4f0617a8dcdb38bd16387c38ec70b9f451` | `267b5d6506caa0b4e8d768db0beef70285fc0ae2693a1d0d608a0d0567377bcb` | identical |
| `OnboardingSocioCompuOscuro` | `e8060e971578b62d13bcb81dc889ad4f0617a8dcdb38bd16387c38ec70b9f451` | `636c8826820db72d9cdb6ad2f1e571478788a260d6e97706e4e3403f7502d001` | `e8060e971578b62d13bcb81dc889ad4f0617a8dcdb38bd16387c38ec70b9f451` | `636c8826820db72d9cdb6ad2f1e571478788a260d6e97706e4e3403f7502d001` | identical |
| `OnboardingSocioOscuro` | `d3e5b78ffc6a400f08f8e0dae22828b240d56f09c559632aafb26a4a17034b2d` | `c8b4d56da454431c9b740de2de2f30ed321e319dd7707d2ef083ace3c8461350` | `d3e5b78ffc6a400f08f8e0dae22828b240d56f09c559632aafb26a4a17034b2d` | `c8b4d56da454431c9b740de2de2f30ed321e319dd7707d2ef083ace3c8461350` | identical |
| `OnboardingStock` | `54e84963e15e7bc514cfb2a55c2a6cb4414f3afd7fbd0b53acf27cf60968ab9f` | `237e74327126e59e846a697770e819889ba570f55d68c52a241c0cfbc7c3d3c1` | `54e84963e15e7bc514cfb2a55c2a6cb4414f3afd7fbd0b53acf27cf60968ab9f` | `237e74327126e59e846a697770e819889ba570f55d68c52a241c0cfbc7c3d3c1` | identical |
| `OnboardingStockCompu` | `6b728c65c5b3fe64a419d3b04b0bd42988a41137b1c464f1c592bf7f3e4c1471` | `9b9bdac3e20a2279633a44be10d1bf3404c516c42554b3a2f2ce253929ceea33` | `6b728c65c5b3fe64a419d3b04b0bd42988a41137b1c464f1c592bf7f3e4c1471` | `9b9bdac3e20a2279633a44be10d1bf3404c516c42554b3a2f2ce253929ceea33` | identical |
| `OnboardingStockCompuOscuro` | `6b728c65c5b3fe64a419d3b04b0bd42988a41137b1c464f1c592bf7f3e4c1471` | `7c657b9148f77dcb6ff7c2884113bd8f9243fb8acdb063c1f7a9abe9af73ceba` | `6b728c65c5b3fe64a419d3b04b0bd42988a41137b1c464f1c592bf7f3e4c1471` | `7c657b9148f77dcb6ff7c2884113bd8f9243fb8acdb063c1f7a9abe9af73ceba` | identical |
| `OnboardingStockOscuro` | `54e84963e15e7bc514cfb2a55c2a6cb4414f3afd7fbd0b53acf27cf60968ab9f` | `7f6692c3c25e7b8ee5a01b9a30caf20f44246ec61195761d556a7d085b535d2d` | `54e84963e15e7bc514cfb2a55c2a6cb4414f3afd7fbd0b53acf27cf60968ab9f` | `7f6692c3c25e7b8ee5a01b9a30caf20f44246ec61195761d556a7d085b535d2d` | identical |
| `OnboardingVariedad` | `1f3cdf165f5acda6360108ea0b9e71b73aa95134a91b23492f652d87507864f4` | `43a89c5d041c27a73fce0cf5b56b79cc8c12bd657a33cab16dba4c606fe4359b` | `1f3cdf165f5acda6360108ea0b9e71b73aa95134a91b23492f652d87507864f4` | `43a89c5d041c27a73fce0cf5b56b79cc8c12bd657a33cab16dba4c606fe4359b` | identical |
| `OnboardingVariedadOscuro` | `1f3cdf165f5acda6360108ea0b9e71b73aa95134a91b23492f652d87507864f4` | `5aef30dd468ee74f061d96077fbb26fa3864c9bc4923300e538cbdc36acdc801` | `1f3cdf165f5acda6360108ea0b9e71b73aa95134a91b23492f652d87507864f4` | `5aef30dd468ee74f061d96077fbb26fa3864c9bc4923300e538cbdc36acdc801` | identical |
| `PrecioNuevo` | `5df7a03b4832a2fcc769bccd254ee222b934ed3e311eeafcf52196c4e3ada2f7` | `6a83fc6300a5fb483c6ccc5864ae6ea12e73d5aed55873b87f2226878ecf3a94` | `5df7a03b4832a2fcc769bccd254ee222b934ed3e311eeafcf52196c4e3ada2f7` | `6a83fc6300a5fb483c6ccc5864ae6ea12e73d5aed55873b87f2226878ecf3a94` | identical |
| `PrecioNuevoCompu` | `43ac349df3c0a6fa6a9c924b6d833852c667e83142631705f6a415b9b8cd9168` | `9186ec993629f6e3092540cece274180475fcc179065d686a3badda9c5e994f4` | `43ac349df3c0a6fa6a9c924b6d833852c667e83142631705f6a415b9b8cd9168` | `9186ec993629f6e3092540cece274180475fcc179065d686a3badda9c5e994f4` | identical |
| `PrecioNuevoCompuOscuro` | `43ac349df3c0a6fa6a9c924b6d833852c667e83142631705f6a415b9b8cd9168` | `4ff65ad8f82d3b3f800b2ad0dd1bebfa64c7651e87db56949f2d65da0045d742` | `43ac349df3c0a6fa6a9c924b6d833852c667e83142631705f6a415b9b8cd9168` | `4ff65ad8f82d3b3f800b2ad0dd1bebfa64c7651e87db56949f2d65da0045d742` | identical |
| `PrecioNuevoOscuro` | `5df7a03b4832a2fcc769bccd254ee222b934ed3e311eeafcf52196c4e3ada2f7` | `78c3e6403e0ab25e41c2c0cd07f1069000d53a3d3c44f06f0651461cef93ed3c` | `5df7a03b4832a2fcc769bccd254ee222b934ed3e311eeafcf52196c4e3ada2f7` | `78c3e6403e0ab25e41c2c0cd07f1069000d53a3d3c44f06f0651461cef93ed3c` | identical |
| `Reset` | `d3467cf69ec3a3f02a7ac9d9e73103db5f62c68f8e4b7691c24fb4e41544e688` | `16cd197d20dec23feb77008a4fdf985911af82487561961b609e318cf9e06411` | `d3467cf69ec3a3f02a7ac9d9e73103db5f62c68f8e4b7691c24fb4e41544e688` | `16cd197d20dec23feb77008a4fdf985911af82487561961b609e318cf9e06411` | identical |
| `ResetOscuro` | `d3467cf69ec3a3f02a7ac9d9e73103db5f62c68f8e4b7691c24fb4e41544e688` | `16ca38c6346a35f5e36756e0913f3f386115ef1430ec78ec9b348536fe5647d7` | `d3467cf69ec3a3f02a7ac9d9e73103db5f62c68f8e4b7691c24fb4e41544e688` | `16ca38c6346a35f5e36756e0913f3f386115ef1430ec78ec9b348536fe5647d7` | identical |
| `RetiroDetalle` | `829c922709bbcc4c0c9ecc1ff6483578dadf033ce3c23278550956beb4d2cb23` | `cdae76499f385a91a6427661f91d7692210c0fddf95dfcde16bcece7dc167a34` | `829c922709bbcc4c0c9ecc1ff6483578dadf033ce3c23278550956beb4d2cb23` | `cdae76499f385a91a6427661f91d7692210c0fddf95dfcde16bcece7dc167a34` | identical |
| `RetiroDetalleOscuro` | `829c922709bbcc4c0c9ecc1ff6483578dadf033ce3c23278550956beb4d2cb23` | `b50115c8d740af5e998b8347b291602db207280447f9e40876da5d9c3ad9ea41` | `829c922709bbcc4c0c9ecc1ff6483578dadf033ce3c23278550956beb4d2cb23` | `b50115c8d740af5e998b8347b291602db207280447f9e40876da5d9c3ad9ea41` | identical |
| `SacarDelStock` | `3161c51fd6b825c8168e3b83dd789e717657f12907ba7acfe6fc78360b1d64e0` | `35e3b6f604e0b4d27fd86e5afcd84e32770485adfa48afb78e4d583a0aee8db6` | `3161c51fd6b825c8168e3b83dd789e717657f12907ba7acfe6fc78360b1d64e0` | `35e3b6f604e0b4d27fd86e5afcd84e32770485adfa48afb78e4d583a0aee8db6` | identical |
| `SacarDelStockCompu` | `dd9fce8bcd75d6f62df51c907782d8a42e20d6250aa573d3461fbadcc489e50c` | `6629cc72a925b50c961c514d39ee7daf5f8f46518ad2d7246c7638082d7e95d7` | `dd9fce8bcd75d6f62df51c907782d8a42e20d6250aa573d3461fbadcc489e50c` | `6629cc72a925b50c961c514d39ee7daf5f8f46518ad2d7246c7638082d7e95d7` | identical |
| `TodasLasEntradas` | `b110cda23a16691da350c4893b695caf671c2cd2c5b01fa76a4e0ea38146cfde` | `d57f08fa9dfabd31fad6c55f36906f87f93cc0a940e5b9ddc131b1c1b3cd9495` | `b110cda23a16691da350c4893b695caf671c2cd2c5b01fa76a4e0ea38146cfde` | `d57f08fa9dfabd31fad6c55f36906f87f93cc0a940e5b9ddc131b1c1b3cd9495` | identical |
| `TodasLasEntradasOscuro` | `b110cda23a16691da350c4893b695caf671c2cd2c5b01fa76a4e0ea38146cfde` | `60f193da3e6e0c74a9e0080406df1e9b3246e0c30cd204a8babcaef48171f877` | `b110cda23a16691da350c4893b695caf671c2cd2c5b01fa76a4e0ea38146cfde` | `60f193da3e6e0c74a9e0080406df1e9b3246e0c30cd204a8babcaef48171f877` | identical |
| `TodasLasEntradasVariedad` | `b110cda23a16691da350c4893b695caf671c2cd2c5b01fa76a4e0ea38146cfde` | `1ebc7d7c6261f0f8051a44453a1827dbcd513ec54b06fb5e63d2f816274fd88b` | `b110cda23a16691da350c4893b695caf671c2cd2c5b01fa76a4e0ea38146cfde` | `1ebc7d7c6261f0f8051a44453a1827dbcd513ec54b06fb5e63d2f816274fd88b` | identical |
| `TodasLasEntradasVariedadOscuro` | `b110cda23a16691da350c4893b695caf671c2cd2c5b01fa76a4e0ea38146cfde` | `3dff3ce34e644ab6bd5eb83a0720dea9ee419318cd750cdb63c03d78797cf0b3` | `b110cda23a16691da350c4893b695caf671c2cd2c5b01fa76a4e0ea38146cfde` | `3dff3ce34e644ab6bd5eb83a0720dea9ee419318cd750cdb63c03d78797cf0b3` | identical |
| `VariedadArchivada` | `86ff7181050e53b6e320c9d0b89010876611389e368ffb6b29d7fa510bf15b09` | `104126f05994423f955e1075379d25c5ac5673e3e790ffab34fd98214163df5c` | `86ff7181050e53b6e320c9d0b89010876611389e368ffb6b29d7fa510bf15b09` | `04aa80319b540ddaf69eb00ddc66bdac2f01f443fb53837172ee8106bce52079` | differs, not fix-driven (without side caught the loading skeleton) |
| `VariedadArchivadaOscuro` | `86ff7181050e53b6e320c9d0b89010876611389e368ffb6b29d7fa510bf15b09` | `d8f90496f54d122d82dee8eb66c3700932a3d0b48772f6abc66663b082bb4a2e` / `4509f01481747c937658e43e4d2be582e588746280964c144b8368a17796fcb8` | `86ff7181050e53b6e320c9d0b89010876611389e368ffb6b29d7fa510bf15b09` | `aa28b57d063c71c076bb8559df37296d413c21b7b8b6704e6d9fc496e0f2b777` / `4509f01481747c937658e43e4d2be582e588746280964c144b8368a17796fcb8` | unstable within a side (shares a hash across sides) |
| `VariedadDetalle` | `86ff7181050e53b6e320c9d0b89010876611389e368ffb6b29d7fa510bf15b09` | `445c09de4772b29a8331c9d0f94a9511bd648ecef589697fd79e30c40a6a67ae` | `86ff7181050e53b6e320c9d0b89010876611389e368ffb6b29d7fa510bf15b09` | `9f072602f55327c3ac06da9adb75371cfead1b9dd14797f022e41214d6e8a020` / `445c09de4772b29a8331c9d0f94a9511bd648ecef589697fd79e30c40a6a67ae` | unstable within a side (shares a hash across sides) |
| `VariedadDetalleOscuro` | `86ff7181050e53b6e320c9d0b89010876611389e368ffb6b29d7fa510bf15b09` | `3a0cf7c81d1e22d4c48fe37e9194968d2ca14f7708307752dab79a8ce45094f5` | `86ff7181050e53b6e320c9d0b89010876611389e368ffb6b29d7fa510bf15b09` | `3a0cf7c81d1e22d4c48fe37e9194968d2ca14f7708307752dab79a8ce45094f5` | identical |
| `VariedadNueva` | `4af90e7ce430db20cbfad40ebfbb4e60899d7a577760192dd1008c4a9f80e2c2` | `0dac8a658ed305136b6f74094eb72641dedd986640e5fc50d8eb583eef659e90` | `4af90e7ce430db20cbfad40ebfbb4e60899d7a577760192dd1008c4a9f80e2c2` | `0dac8a658ed305136b6f74094eb72641dedd986640e5fc50d8eb583eef659e90` | identical |
| `VariedadNuevaCompu` | `3e4afeee794bfc951b15918c223b3c6c06ad9cc442f1de8536207f3500c352f2` | `20ba5865897e3028d48639a582cab89d8896712f3704f3f5c181f9e4a69b773f` | `3e4afeee794bfc951b15918c223b3c6c06ad9cc442f1de8536207f3500c352f2` | `20ba5865897e3028d48639a582cab89d8896712f3704f3f5c181f9e4a69b773f` | identical |
| `Variedades` | `bb2cce777081d15893928b36c0294f1b54ed277a2f9dafe83cd39103b2e2849b` | `18a3b5ffbbf4c75c20ab3e91d1de373ff15b34691347a5451a16bd86c9f798a4` | `bb2cce777081d15893928b36c0294f1b54ed277a2f9dafe83cd39103b2e2849b` | `18a3b5ffbbf4c75c20ab3e91d1de373ff15b34691347a5451a16bd86c9f798a4` | identical |
| `VariedadesCompu` | `e7eeaec6e8124c8b1be8f80d1405f11fd652b15307b8944460c205288372a2e0` | `da8b4115671a8f41b92e3122afb013e1e6248515692531c356e75badfa9ae037` | `e7eeaec6e8124c8b1be8f80d1405f11fd652b15307b8944460c205288372a2e0` | `da8b4115671a8f41b92e3122afb013e1e6248515692531c356e75badfa9ae037` / `00a42598c1b5e4853a21bd3c6898c5940f4650063c955845086cc6cebf75c3f9` | unstable within a side (shares a hash across sides) |
| `VentaDetalle` | `829c922709bbcc4c0c9ecc1ff6483578dadf033ce3c23278550956beb4d2cb23` | `5f7eb9adc19bc42aac96e92d21adfae6432fc18b723657b6240fa11cf63100b9` | `829c922709bbcc4c0c9ecc1ff6483578dadf033ce3c23278550956beb4d2cb23` | `5f7eb9adc19bc42aac96e92d21adfae6432fc18b723657b6240fa11cf63100b9` | identical |
| `VentaDetalleCompu` | `440d9f1363cb042d481ee515c54a93fea36b04ebbfa867eb4c3c3ce4a6909260` | `37911bc8745ebc0e078ed282bac649959ede8b6ffe236c4bb549b3c2d0892129` | `440d9f1363cb042d481ee515c54a93fea36b04ebbfa867eb4c3c3ce4a6909260` | `37911bc8745ebc0e078ed282bac649959ede8b6ffe236c4bb549b3c2d0892129` | identical |
| `VentaDetalleCompuOscuro` | `440d9f1363cb042d481ee515c54a93fea36b04ebbfa867eb4c3c3ce4a6909260` | `d0fbe4136198c94e9c5135f551f095c48a659713def76378db17b4812183c3aa` | `440d9f1363cb042d481ee515c54a93fea36b04ebbfa867eb4c3c3ce4a6909260` | `d0fbe4136198c94e9c5135f551f095c48a659713def76378db17b4812183c3aa` | identical |
| `VentaDetalleOscuro` | `829c922709bbcc4c0c9ecc1ff6483578dadf033ce3c23278550956beb4d2cb23` | `490244d4bb9d12fee8c111760e749e881ecdf57c05bc825ce057be4d781cca77` | `829c922709bbcc4c0c9ecc1ff6483578dadf033ce3c23278550956beb4d2cb23` | `490244d4bb9d12fee8c111760e749e881ecdf57c05bc825ce057be4d781cca77` | identical |
| `VentaGuardada` | `3ecfb74598a293c0a493ce83981e7e2033a6fb2f6cbbb215c67c955bffdc1e99` | `c18cd697f45825f47a7de9385c213863ac54cae00bcad6723bb85316d9bf1759` | `3ecfb74598a293c0a493ce83981e7e2033a6fb2f6cbbb215c67c955bffdc1e99` | `c18cd697f45825f47a7de9385c213863ac54cae00bcad6723bb85316d9bf1759` | identical |
| `VentaGuardadaOscuro` | `3ecfb74598a293c0a493ce83981e7e2033a6fb2f6cbbb215c67c955bffdc1e99` | `35fb511cceed598b15990d097c1379dd262d9ff18423cc3c2507dfcf92ae0fb1` | `3ecfb74598a293c0a493ce83981e7e2033a6fb2f6cbbb215c67c955bffdc1e99` | `35fb511cceed598b15990d097c1379dd262d9ff18423cc3c2507dfcf92ae0fb1` | identical |
| `Ventas` | `a1969edd847169c48c5cef9cdc28d3bc2c4ac8848278cbefc884ee980813bb2b` | `e059254a3c52f44b4b1d539e7c2b4bfddec6dac57fbe5abeb7ec7dd76af7d6e6` | `a1969edd847169c48c5cef9cdc28d3bc2c4ac8848278cbefc884ee980813bb2b` | `e059254a3c52f44b4b1d539e7c2b4bfddec6dac57fbe5abeb7ec7dd76af7d6e6` | identical |
| `VentasCompu` | `e00137456865ca1419a87c0640a2587588937cf86c2cb6bbeb65665608c3a615` | `7836c3b46d8f7a6eba4a1a703b8e99760dc9fe6f0a6bbd6fe2e7d3814cc71317` | `e00137456865ca1419a87c0640a2587588937cf86c2cb6bbeb65665608c3a615` | `7836c3b46d8f7a6eba4a1a703b8e99760dc9fe6f0a6bbd6fe2e7d3814cc71317` | identical |
| `VentasCompuOscuro` | `e00137456865ca1419a87c0640a2587588937cf86c2cb6bbeb65665608c3a615` | `bbf26512237c24cf53046b967b70e45288538022636219fdf3fadc4b5077ade4` | `e00137456865ca1419a87c0640a2587588937cf86c2cb6bbeb65665608c3a615` | `bbf26512237c24cf53046b967b70e45288538022636219fdf3fadc4b5077ade4` | identical |
| `VentasOscuro` | `a1969edd847169c48c5cef9cdc28d3bc2c4ac8848278cbefc884ee980813bb2b` | `9698009455a7ad3612acc3a6b4b46f8c826946a15aeaee7c410fa5b47ec414c8` | `a1969edd847169c48c5cef9cdc28d3bc2c4ac8848278cbefc884ee980813bb2b` | `9698009455a7ad3612acc3a6b4b46f8c826946a15aeaee7c410fa5b47ec414c8` | identical |
| `VerTodas` | `c0dd1e0acba7dcdd9d2b8d3b46266b054d0a08d1628fc877639b4fa5cd3579ff` | `97e0e31d5a3a3e38d2b49a77e77e4b87aca11b8ca378c37efc2512791039b62b` | `c0dd1e0acba7dcdd9d2b8d3b46266b054d0a08d1628fc877639b4fa5cd3579ff` | `97e0e31d5a3a3e38d2b49a77e77e4b87aca11b8ca378c37efc2512791039b62b` | identical |
| `VerTodasOscuro` | `c0dd1e0acba7dcdd9d2b8d3b46266b054d0a08d1628fc877639b4fa5cd3579ff` | `075d01ee8fa43d929ead1af63a5ddc5c5d5499e3db4f83f07d61871fb8ad10ce` | `c0dd1e0acba7dcdd9d2b8d3b46266b054d0a08d1628fc877639b4fa5cd3579ff` | `075d01ee8fa43d929ead1af63a5ddc5c5d5499e3db4f83f07d61871fb8ad10ce` | identical |
