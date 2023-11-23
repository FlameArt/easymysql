declare class MySQLClass {
   connected: boolean;
   isLogging: boolean;
   DisableInsertIgnore: boolean;

   constructor();

   connect(host: string, port: number, user: string, password: string, database: string): Promise<void>;

   disconnect(): Promise<boolean>;

   all(query: string, params?: any[], array?: any[]): Promise<any[]>;

   one(query: string, params?: any[]): Promise<any>;

   BulkUpdate(table: string, values: any[], exclude_fields?: string[], where_update?: string[]): Promise<any>;

   insertOne(table: string, data: Record<string, any>): Promise<any>;

   updateOne(table: string, data: Record<string, any>, id?: any, where?: string): Promise<any>;

   escape(str: string): string;

   escapeID(str: string): string;

   selectAll(tables: string, where?: string, whereparams?: any[], orderBy?: string): Promise<any[]>;

   get(tables: string, where?: string, whereparams?: any[], orderBy?: string): Promise<any>;
}

export = MySQLClass;
