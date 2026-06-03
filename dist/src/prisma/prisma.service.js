"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var PrismaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
let PrismaService = class PrismaService extends client_1.PrismaClient {
    static { PrismaService_1 = this; }
    static pgPool;
    static pgAdapter;
    constructor() {
        const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/universal_admin?schema=public';
        if (!PrismaService_1.pgPool) {
            PrismaService_1.pgPool = new pg_1.Pool({ connectionString });
            PrismaService_1.pgAdapter = new adapter_pg_1.PrismaPg(PrismaService_1.pgPool);
        }
        super({
            adapter: PrismaService_1.pgAdapter,
        });
    }
    async onModuleInit() {
        await this.$connect();
    }
    async onModuleDestroy() {
        await this.$disconnect();
        if (PrismaService_1.pgPool) {
            await PrismaService_1.pgPool.end();
        }
    }
};
exports.PrismaService = PrismaService;
exports.PrismaService = PrismaService = PrismaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], PrismaService);
//# sourceMappingURL=prisma.service.js.map