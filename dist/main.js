"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { rawBody: true });
    const frontendOrigins = process.env.FRONTEND_URL?.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
    if (frontendOrigins?.length) {
        app.enableCors({ origin: frontendOrigins });
    }
    app.enableShutdownHooks();
    await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
//# sourceMappingURL=main.js.map