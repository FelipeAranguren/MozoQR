declare module 'mercadopago' {
  export class MercadoPagoConfig {
    constructor(config: { accessToken: string });
  }

  export class Preference {
    constructor(client: MercadoPagoConfig);
    create(options: { body: any }): Promise<any>;
    get(options: { preferenceId: string }): Promise<any>;
  }

  export class Payment {
    constructor(client: MercadoPagoConfig);
    create(options: { body: any }): Promise<any>;
    get(options: { id: string }): Promise<any>;
  }
}
