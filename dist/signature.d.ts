export declare function signPayload(body: Buffer | string, secret: string): string;
export declare function safeEqual(a: string, b: string): boolean;
export declare function isValidSignature(body: Buffer | string, signature: string, secret: string): boolean;
