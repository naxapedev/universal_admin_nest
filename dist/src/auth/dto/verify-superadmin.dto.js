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
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerifySuperAdminDto = void 0;
const class_validator_1 = require("class-validator");
class VerifySuperAdminDto {
    email;
    code;
}
exports.VerifySuperAdminDto = VerifySuperAdminDto;
__decorate([
    (0, class_validator_1.IsEmail)({}, { message: 'Please provide a valid email address.' }),
    __metadata("design:type", String)
], VerifySuperAdminDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'Verification code is required.' }),
    (0, class_validator_1.IsNumberString)({}, { message: 'Verification code must be a numeric string.' }),
    __metadata("design:type", String)
], VerifySuperAdminDto.prototype, "code", void 0);
//# sourceMappingURL=verify-superadmin.dto.js.map