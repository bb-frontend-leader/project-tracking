/**
 * Value Object representing content validation rules
 * Encapsulates validation criteria for HTTP response content
 */
export interface ContentValidation {
    /** Substring (case-insensitive) that must appear in the page <title> */
    expectedTitle?: string;

    /** Detect directory listings ("Index of /...") served by nginx autoindex or Apache */
    checkForDirectoryListing?: boolean;

    /** Texts that must NOT appear in the page (default server pages, soft 404s, etc.) */
    forbiddenText?: string[];

    /** Verify that same-origin scripts and stylesheets referenced by the page respond OK */
    checkAssets?: boolean;
}

/**
 * Keys accepted in a content validation block.
 * Used to reject typos when loading the services file.
 */
export const CONTENT_VALIDATION_KEYS: ReadonlyArray<keyof ContentValidation> = [
    'expectedTitle',
    'checkForDirectoryListing',
    'forbiddenText',
    'checkAssets'
];
