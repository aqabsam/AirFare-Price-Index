create table if not exists raw_fare_pages (
  id bigserial primary key,
  raw_record_key text not null unique,
  source text not null,
  route_key text not null,
  origin_code char(3) not null,
  destination_code char(3) not null,
  departure_date date not null,
  collected_at timestamptz not null default now(),
  payload jsonb not null
);

create table if not exists rejected_fares (
  raw_record_key text primary key,
  source text not null,
  route_key text not null,
  origin_code char(3) not null,
  destination_code char(3) not null,
  departure_date date not null,
  collected_at timestamptz not null,
  source_type text not null,
  collection_stage text,
  rejection_reason text not null,
  data_quality_status text,
  data_quality_score integer,
  payload jsonb not null
);

create table if not exists normalized_fares (
  id text primary key,
  route_key text not null,
  origin_code char(3) not null,
  destination_code char(3) not null,
  departure_date date not null,
  collected_at timestamptz not null default now(),
  airline text not null,
  airline_code text not null,
  flight_number text not null,
  departure_time text not null,
  arrival_time text not null,
  duration_minutes integer not null,
  stops integer not null,
  price integer not null,
  base_fare integer,
  taxes integer,
  udf integer,
  convenience_fee integer,
  total_fare integer,
  currency char(3) not null,
  seats_remaining integer not null,
  source text not null,
  source_type text not null,
  confidence double precision not null default 1.0,
  fare_class text,
  sold_out boolean not null default false,
  data_quality_score integer,
  data_quality_status text,
  rejected_reason text,
  collection_stage text
);

create table if not exists airfare_index_snapshots (
  id bigserial primary key,
  snapshot_key text not null unique,
  route_key text not null,
  departure_date date not null,
  cheapest_price numeric(12, 2) not null,
  average_price numeric(12, 2) not null,
  median_price numeric(12, 2) not null,
  airfare_index numeric(12, 4) not null,
  calculated_at timestamptz not null default now()
);
