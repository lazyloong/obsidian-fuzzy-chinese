import { defineConfig, loadEnv, Plugin } from "vite";
import { resolve } from "path";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "fs";

const root = process.cwd();

// ============================================================
// 插件1：构建完成后将 styles.css / manifest.json 复制到 dist/
// ============================================================
function copyStaticFiles(): Plugin {
    const files = ["styles.css", "manifest.json"];
    return {
        name: "obsidian:copy-static",
        writeBundle() {
            for (const file of files) {
                const src = resolve(root, file);
                const dest = resolve(root, "dist", file);
                if (existsSync(src)) {
                    copyFileSync(src, dest);
                    console.log(`  ✓ ${file} → dist/${file}`);
                }
            }
        },
    };
}

// ============================================================
// 插件2：构建完成后将 dist/ 产物部署到 Obsidian vault
// 通过环境变量 OBSIDIAN_VAULT 传入库路径
// ============================================================
function deployToVault(vaultPath: string | undefined): Plugin {
    return {
        name: "obsidian:deploy-to-vault",
        writeBundle() {
            if (!vaultPath) return;
            vaultPath = vaultPath.trim();
            if (!vaultPath) return;

            const manifest = JSON.parse(readFileSync(resolve(root, "manifest.json"), "utf-8"));
            const pluginId: string = manifest.id; // fuzzy-chinese-pinyin
            const pluginDir = resolve(vaultPath, ".obsidian", "plugins", pluginId);

            mkdirSync(pluginDir, { recursive: true });

            const distDir = resolve(root, "dist");
            for (const file of readdirSync(distDir)) {
                const src = resolve(distDir, file);
                if (statSync(src).isFile()) {
                    copyFileSync(src, resolve(pluginDir, file));
                }
            }
            console.log(`  ✓ deployed to ${pluginDir}`);
        },
    };
}

// ============================================================
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), ["OBSIDIAN_", "VITE_"]);

    return {
        envPrefix: ["OBSIDIAN_", "VITE_"],
        plugins: [copyStaticFiles(), deployToVault(env.OBSIDIAN_VAULT)],
        build: {
            lib: {
                entry: resolve(root, "src/main.ts"),
                formats: ["cjs"],
                fileName: () => "main.js",
            },
            outDir: "dist",
            emptyOutDir: true,
            rollupOptions: {
                external: ["obsidian"],
                output: {
                    exports: "named",
                    codeSplitting: false,
                },
            },
            commonjsOptions: {
                transformMixedEsModules: true,
            },
        },
        resolve: {
            alias: {
                "@": resolve(root, "src"),
            },
        },
    };
});
