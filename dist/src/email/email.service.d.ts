export declare class EmailService {
    private readonly logger;
    private transporter;
    constructor();
    sendVerificationEmail(email: string, code: number): Promise<void>;
}
