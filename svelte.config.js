import adapter from "@sveltejs/adapter-static";
import { sveltePreprocess } from "svelte-preprocess";

/** @type {import('@sveltejs/kit').Config} */
const config = {
    preprocess: sveltePreprocess({
        scss: {
            includePaths: ["src"],
        },
    }),
    compilerOptions: {
        runes: true,
    },
    kit: {
        adapter: adapter({
            // default options are shown. On some platforms
            // these options are set automatically — see below
            pages: "build",
            assets: "build",
            fallback: "404.html",
            precompress: false,
            strict: true,
        }),
        paths: {
            base: process.argv.includes("dev") ? "" : process.env.BASE_PATH,
        },
    },
};

export default config;
