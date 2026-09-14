-- =====================================================================
--  Migración 002 · Edición de funciones
--  Para bases creadas con una versión anterior de schema.sql.
--  Uso: Supabase > SQL Editor > New query > pegar todo el archivo > Run
--  Se puede ejecutar más de una vez sin problemas.
-- =====================================================================

-- Valida horario futuro y sala activa también cuando se edita una función.
create or replace function public.calcular_horario_funcion()
returns trigger
language plpgsql
as $$
declare
  v_duracion int;
begin
  select duracion_min into v_duracion from public.peliculas where id = new.pelicula_id;
  if v_duracion is null then
    raise exception 'La película no existe';
  end if;

  if tg_op = 'INSERT' or new.inicio is distinct from old.inicio then
    if new.inicio <= now() then
      raise exception 'No se pueden programar funciones en el pasado';
    end if;
  end if;

  if tg_op = 'INSERT' or new.sala_id is distinct from old.sala_id then
    if not exists (select 1 from public.salas where id = new.sala_id and activa) then
      raise exception 'La sala no está activa';
    end if;
  end if;

  new.fin := new.inicio + make_interval(mins => v_duracion);
  new.bloqueada_hasta := new.fin + interval '30 minutes';
  return new;
end;
$$;

drop trigger if exists trg_funciones_horario on public.funciones;
create trigger trg_funciones_horario
  before insert or update of inicio, pelicula_id, sala_id on public.funciones
  for each row execute function public.calcular_horario_funcion();

-- Con entradas vendidas solo se puede cambiar el precio.
create or replace function public.proteger_funcion_con_ventas()
returns trigger
language plpgsql
as $$
begin
  if (new.inicio, new.sala_id, new.pelicula_id, new.formato, new.idioma)
       is distinct from (old.inicio, old.sala_id, old.pelicula_id, old.formato, old.idioma)
     and exists (select 1 from public.entradas where funcion_id = old.id) then
    raise exception 'La función ya tiene entradas vendidas: solo se puede cambiar el precio';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_funciones_con_ventas on public.funciones;
create trigger trg_funciones_con_ventas
  before update on public.funciones
  for each row execute function public.proteger_funcion_con_ventas();
