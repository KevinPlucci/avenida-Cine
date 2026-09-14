import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { createClient, processLock, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { crearFetchConHttpClient } from './http/fetch-con-http-client';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly configurado = !environment.supabaseUrl.includes('TU-PROYECTO');

  readonly client: SupabaseClient = createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
    // processLock evita el error "NavigatorLockAcquireTimeoutError" de supabase-js en Angular.
    auth: { lock: processLock },
    // Las llamadas a Supabase salen por HttpClient, así pasan por los interceptores de la app.
    global: { fetch: crearFetchConHttpClient(inject(HttpClient)) },
  });
}
