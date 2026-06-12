"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const prisma_module_1 = require("./prisma/prisma.module");
const auth_module_1 = require("./auth/auth.module");
const email_module_1 = require("./email/email.module");
const users_module_1 = require("./users/users.module");
const global_users_module_1 = require("./global-users/global-users.module");
const companies_module_1 = require("./companies/companies.module");
const products_module_1 = require("./products/products.module");
const global_exception_filter_1 = require("./common/filters/global-exception.filter");
const universal_auth_module_1 = require("./universal-auth/universal-auth.module");
const logs_module_1 = require("./logs/logs.module");
const activity_logs_module_1 = require("./activity-logs/activity-logs.module");
const activity_log_interceptor_1 = require("./activity-logs/activity-log.interceptor");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            prisma_module_1.PrismaModule,
            auth_module_1.AuthModule,
            email_module_1.EmailModule,
            users_module_1.UsersModule,
            global_users_module_1.GlobalUsersModule,
            companies_module_1.CompaniesModule,
            products_module_1.ProductsModule,
            universal_auth_module_1.UniversalAuthModule,
            logs_module_1.LogsModule,
            activity_logs_module_1.ActivityLogsModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [
            app_service_1.AppService,
            {
                provide: core_1.APP_FILTER,
                useClass: global_exception_filter_1.GlobalExceptionFilter,
            },
            {
                provide: core_1.APP_INTERCEPTOR,
                useClass: activity_log_interceptor_1.ActivityLogInterceptor,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map