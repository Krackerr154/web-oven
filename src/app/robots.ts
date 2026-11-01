import type { MetadataRoute } from "next";

/**
 * AP-Lab is an authenticated internal laboratory tool, not a public site.
 * Every route sits behind NextAuth and carries personal data — member names,
 * NIMs, supervisor assignments, booking history and lab inventory.
 * Nothing here should ever be crawled or indexed.
 */
export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: "*",
                disallow: "/",
            },
        ],
    };
}
