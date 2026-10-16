# GH-150: compare.sh with and without the `.disposicion .ajustes-grupo` hunk (partial)

Partial record, one capture per side, taken at load average 50 to 97 on 16 cores.

- With: `fe7bdef95cf2af9f034c6baf0cff1cf95dd84978` (origin/master, which already holds the hunk).
- Without: local commit `279af14d21eb22eb3e03f5a1ac591550c4ea014c` on top of the same commit, never pushed. Its diff:

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

- `design` hashes: identical on all 127 screens across the sides.
- `built` hashes that differ (SHA-256), 18 screens. The eight `Configuracion*Compu` are expected and fix-driven (the group card regains its 80 px top padding at 1280 px). `ConfiguracionIntegracionesCompuOscuro` is probably fix-driven. The rest cannot be classified from one capture; the `EstadosSinConexion*` ones also logged a page font error and `OnboardingListo` and `EstadosConfirmar` timed out under load.

| Screen | without `built` | with `built` |
| --- | --- | --- |
| `Analisis` | `2c03fe4ba9bc8c539ade0922515deaebf71a52965da052fc7b84481521957252` | `febe013657c88d9eff61257fc5ddb4aec01fbe21674563abdc783da9f190aa0e` |
| `ConfiguracionAparienciaCompu` | `a0f5db6f1e8f645efc18bdabf8267541881520f1e9a5db20362587fb224202d4` | `b0cc61643899b3af66451eec5cc974ad88465b37039cc44ddab22344538313e0` |
| `ConfiguracionCategoriasCompu` | `879830f8d24d06675176e31c52546b5a633550434ba530698854e2dfb58944ba` | `71fb9ddeb4874963c1a602cbfb8f48a79ac66a605ab91b26cf64a2609e249ab2` |
| `ConfiguracionCuentaCompu` | `aafc68797c9dff12ee7a67142efcee4b998debdb025119ef2fb3fb2b0f98c844` | `59d2be46fa2c44fc386fed82d46d19ffe1deae0e33dcd2a7a36553ad3dca823b` |
| `ConfiguracionIntegracionesCompu` | `11cb055094da22ffe46b9978d018e6f67ee631bac8a7f596c4fcd3974279e859` | `aae4a116e1259efb4eada38d1eb275ba27c17d2cee4b37aca07179ab225fba3b` |
| `ConfiguracionIntegracionesCompuOscuro` | `e2902942ee3b30a396c95e77ac30b80d42edb64264617180432a386e9827916c` | `f1645e2a4bf61ccd67d7f0491f84da5d199d905c57467b91e9450c523fe4a963` |
| `ConfiguracionMensajeCompu` | `a06f49f5fcb4ad09ce9c1f676c647ede40be94c2160182ff4c0c7fb2f9f32039` | `d32c4055ae4dbb739f081ea2c9ba2d814271f95fdb7122ab56fefb529185c523` |
| `ConfiguracionNegocioCompu` | `587ccd565b5df6100d46a3881b2fb1bcffe461a860e4159438aff50d1cedb612` | `11f9d1889c9ffba77d29b66fa0038a3e6158449f9ed36bbf84b6b44ceec506de` |
| `ConfiguracionPreciosCompu` | `a317f7dfc68d0ecb6d81e0b244afe31d1b0400608a1095db85a2d3e3cc0bd864` | `b2383ebbcfc93a1a977742cdc8fbb03da865e62f45d2bfa2347f0f7eb14d0bc5` |
| `ConfiguracionUsuariosCompu` | `96c201c0888f9eb369932f567505c08f4fb0f3507c541b6d96a136efaf2d1f07` | `a6a3447df2f9eb5f653216b2c7d2c1e81dc0062fea142aa298bc372f00c3273e` |
| `EntradaStockEditar` | `88c1c1777fec27d72d45d18878bc54cddaf767ae48134c0465a83d9c22e1e057` | `b59d4fc8fd58633e7693710591c9aab0f3522b292a3d43eb20709657402adc21` |
| `EstadosSinConexion` | `254fa91fd8b58ea82e8b909213768fdd61efdfed3b587322e69b49df67b4f81e` | `142df3a526650500262c74966ac5e3599da71d18fc6b801f42fc7b7402d4f5b8` |
| `EstadosSinConexionCompu` | `980bea44fcb54ca4c4cda75d7c2e18496e3362e117c7e422f51c67155fd9cc0b` | `91dac8944193ef3c8330bfe433c2055ed175242d514537c908c952146b8bd249` |
| `EstadosSinConexionCompuOscuro` | `e87ccaead8e072d9218cb7b5fe1f2cc379bcb11bf2ae72846a5cc95aff1a632a` | `c4480f229c736c88d6866895a9eb27d3e7692a1376f21cad9ecba86ec0920bb7` |
| `EstadosSinConexionOscuro` | `e65e8c9a942317a0771138baf7c768cae932acf0d3455e6a474a64a393421c59` | `ec99de4034a6ae6ea8b8543f4eae5bc5500ebc88cd7e553219e0a2014db3a56b` |
| `VariedadArchivada` | `04aa80319b540ddaf69eb00ddc66bdac2f01f443fb53837172ee8106bce52079` | `104126f05994423f955e1075379d25c5ac5673e3e790ffab34fd98214163df5c` |
| `VariedadArchivadaOscuro` | `aa28b57d063c71c076bb8559df37296d413c21b7b8b6704e6d9fc496e0f2b777` | `d8f90496f54d122d82dee8eb66c3700932a3d0b48772f6abc66663b082bb4a2e` |
| `VariedadDetalle` | `9f072602f55327c3ac06da9adb75371cfead1b9dd14797f022e41214d6e8a020` | `445c09de4772b29a8331c9d0f94a9511bd648ecef589697fd79e30c40a6a67ae` |

Not done: the second capture per side, `ae.mjs`, the guard run on the without side, the PR and the #101 comments.
