"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var EmailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const common_1 = require("@nestjs/common");
const nodemailer = __importStar(require("nodemailer"));
let EmailService = EmailService_1 = class EmailService {
    logger = new common_1.Logger(EmailService_1.name);
    transporter;
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.MAIL_HOST ?? 'smtp.gmail.com',
            port: parseInt(process.env.MAIL_PORT ?? '587', 10),
            secure: false,
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASS,
            },
        });
    }
    async sendVerificationEmail(email, code) {
        const mailOptions = {
            from: process.env.MAIL_USER,
            to: email,
            subject: 'Verify Your Account',
            html: `<!DOCTYPE html>
<html>
  <head><title>Email Verification</title></head>
  <body style="font-family: Arial, sans-serif; background-color: #f9fafb; padding: 20px 0; margin: 0;">
    <div style="max-width: 600px; margin: 20px auto; background: white; padding: 40px 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); text-align: center;">
      <div style="display: flex; align-items: center; justify-content: center; padding-bottom: 30px;">
        <img src="https://app.purifyx.ai/Logo.svg" alt="Logo" width="131" height="37" style="display: block;" />
      </div>
      <h2 style="color: #333; font-size: 32px; font-weight: 500; margin: 0 0 20px 0;">You're almost there!</h2>
      <p style="font-size: 16px; color: #666; font-weight: 400; margin: 0 0 30px 0;">Here is your verification code</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 30px 0; display: inline-block;">
        <span style="font-size: 18px; font-weight: 600; color: #333; letter-spacing: 8px; font-family: 'Courier New', monospace;">
          ${code}
        </span>
      </div>
      <p style="font-size: 12px; color: #999; line-height: 1.6; margin: 30px 0 0 0;">
        By completing sign-up you agree to our
        <a href="#" style="color: #333; text-decoration: underline;">Terms of Service</a> and
        <a href="#" style="color: #333; text-decoration: underline;">Privacy Policy</a>
      </p>
      <p style="font-size: 12px; color: #666; line-height: 1.6; margin: 10px 0 0 0;">© 2025 Universal Admin</p>
    </div>
  </body>
</html>`,
        };
        try {
            await this.transporter.sendMail(mailOptions);
            this.logger.log(`Verification email sent to ${email}`);
        }
        catch (err) {
            this.logger.error(`Failed to send verification email to ${email}`, err);
        }
    }
};
exports.EmailService = EmailService;
exports.EmailService = EmailService = EmailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], EmailService);
//# sourceMappingURL=email.service.js.map