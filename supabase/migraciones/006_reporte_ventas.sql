-- =====================================================================
--  Migración 006 · Reporte de facturación y entradas vendidas por día
--  (email del 28/02)
--  Para bases que ya tienen la migración 005.
--  Uso: Supabase > SQL Editor > New query > pegar todo el archivo > Run
--  Se puede ejecutar más de una vez sin problemas.
-- =====================================================================

-- Facturación y entradas vendidas por día, para el administrador. Incluye los días sin ventas.
-- Cada compra cuenta en el día (de Argentina) en que se hizo, no en el de la función.
create or replace function public.reporte_ventas(p_desde date, p_hasta date)
returns table (dia date, cantidad_compras int, entradas_vendidas int, facturado numeric)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede ver los reportes';
  end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde then
    raise exception 'El período no es válido';
  end if;
  if p_hasta - p_desde > 366 then
    raise exception 'El período puede ser de hasta un año';
  end if;

  return query
  select d.dia,
         count(c.id)::int,
         coalesce(sum(c.cantidad), 0)::int,
         coalesce(sum(c.total), 0)
  from generate_series(p_desde, p_hasta, interval '1 day') as g (fecha)
  cross join lateral (select g.fecha::date as dia) d
  left join public.compras c
    on (c.creado_en at time zone 'America/Argentina/Buenos_Aires')::date = d.dia
  group by d.dia
  order by d.dia;
end;
$$;

grant execute on function public.reporte_ventas(date, date) to authenticated;
