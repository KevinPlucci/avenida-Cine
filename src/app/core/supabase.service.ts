import { Injectable } from '@angular/core';
import { createClient, processLock, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly configurado = !environment.supabaseUrl.includes('TU-PROYECTO');

  readonly client: SupabaseClient = createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
    // processLock evita el error "NavigatorLockAcquireTimeoutError" de supabase-js en Angular.
    auth: { lock: processLock },
  });
}
