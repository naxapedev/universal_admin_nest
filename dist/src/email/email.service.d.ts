import { LogsService } from '../logs/logs.service';
export declare class EmailService {
    private readonly logsService;
    private readonly logger;
    private transporter;
    constructor(logsService: LogsService);
    sendVerificationEmail(email: string, code: number): Promise<void>;
    sendVerificationLinkEmail(email: string, link: string): Promise<void>;
}
