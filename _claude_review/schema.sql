--
-- PostgreSQL database dump
--

\restrict n4S1ZTzobfBi5UwSBSoXlvCX9hf1ndHDbTHPpguOiewGrwjAAyI6gBEYDqYRJge

-- Dumped from database version 16.13 (Homebrew)
-- Dumped by pg_dump version 16.13 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_audit_log; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.admin_audit_log (
    id integer NOT NULL,
    action character varying(100) NOT NULL,
    target character varying(255),
    details jsonb,
    admin_auth character varying(20),
    ip_address character varying(45),
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.admin_audit_log OWNER TO jongho;

--
-- Name: admin_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.admin_audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.admin_audit_log_id_seq OWNER TO jongho;

--
-- Name: admin_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.admin_audit_log_id_seq OWNED BY public.admin_audit_log.id;


--
-- Name: battles; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.battles (
    id integer NOT NULL,
    attacker character varying(42) NOT NULL,
    defender character varying(42) NOT NULL,
    claim_id integer,
    pixels_attacked integer DEFAULT 0 NOT NULL,
    pixels_won integer DEFAULT 0 NOT NULL,
    pixels_lost integer DEFAULT 0 NOT NULL,
    attack_cost numeric(20,6) DEFAULT 0,
    refund_amount numeric(20,6) DEFAULT 0,
    platform_fee numeric(20,6) DEFAULT 0,
    success boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.battles OWNER TO jongho;

--
-- Name: battles_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.battles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.battles_id_seq OWNER TO jongho;

--
-- Name: battles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.battles_id_seq OWNED BY public.battles.id;


--
-- Name: bounties; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.bounties (
    id integer NOT NULL,
    placed_by character varying(42) NOT NULL,
    target_wallet character varying(42) NOT NULL,
    gp_reward numeric(20,6) NOT NULL,
    pp_reward numeric(20,6) DEFAULT 0,
    reason text,
    claimed_by character varying(42),
    claimed_at timestamp with time zone,
    status character varying(20) DEFAULT 'active'::character varying,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT bounties_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'claimed'::character varying, 'expired'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.bounties OWNER TO jongho;

--
-- Name: bounties_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.bounties_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bounties_id_seq OWNER TO jongho;

--
-- Name: bounties_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.bounties_id_seq OWNED BY public.bounties.id;


--
-- Name: citizen_rewards; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.citizen_rewards (
    id integer NOT NULL,
    sector_id integer NOT NULL,
    wallet_address character varying(42) NOT NULL,
    pp_amount numeric(20,6) NOT NULL,
    pixel_count integer NOT NULL,
    payout_cycle timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.citizen_rewards OWNER TO jongho;

--
-- Name: citizen_rewards_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.citizen_rewards_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.citizen_rewards_id_seq OWNER TO jongho;

--
-- Name: citizen_rewards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.citizen_rewards_id_seq OWNED BY public.citizen_rewards.id;


--
-- Name: claims; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.claims (
    id integer NOT NULL,
    owner character varying(42) NOT NULL,
    center_lat numeric(8,2) NOT NULL,
    center_lng numeric(8,2) NOT NULL,
    width integer NOT NULL,
    height integer NOT NULL,
    image_url text,
    link_url text,
    total_paid numeric(20,6) NOT NULL,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    original_image_url text,
    img_scale numeric(6,2) DEFAULT 100,
    img_rotate numeric(5,1) DEFAULT 0,
    img_offset_x integer DEFAULT 0,
    img_offset_y integer DEFAULT 0,
    custom_name character varying(20) DEFAULT NULL::character varying,
    marketplace_locked boolean DEFAULT false,
    sector_code character varying(30),
    price_paid_pp numeric(20,8),
    adjacency_bonus numeric(5,4) DEFAULT 0
);


ALTER TABLE public.claims OWNER TO jongho;

--
-- Name: claims_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.claims_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.claims_id_seq OWNER TO jongho;

--
-- Name: claims_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.claims_id_seq OWNED BY public.claims.id;


--
-- Name: client_errors; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.client_errors (
    id integer NOT NULL,
    message text NOT NULL,
    source text,
    line integer,
    stack text,
    user_agent text,
    url text,
    ip_address text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.client_errors OWNER TO jongho;

--
-- Name: client_errors_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.client_errors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.client_errors_id_seq OWNER TO jongho;

--
-- Name: client_errors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.client_errors_id_seq OWNED BY public.client_errors.id;


--
-- Name: coinflip_games; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.coinflip_games (
    id integer NOT NULL,
    wallet character varying(42) NOT NULL,
    bet_amount numeric(20,6) NOT NULL,
    currency character varying(4) DEFAULT 'PP'::character varying,
    choice character varying(10) NOT NULL,
    result character varying(10) NOT NULL,
    payout numeric(20,6) DEFAULT 0,
    seed text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.coinflip_games OWNER TO jongho;

--
-- Name: coinflip_games_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.coinflip_games_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.coinflip_games_id_seq OWNER TO jongho;

--
-- Name: coinflip_games_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.coinflip_games_id_seq OWNED BY public.coinflip_games.id;


--
-- Name: commander; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.commander (
    id integer NOT NULL,
    commander_wallet character varying(42),
    vice_commander_wallet character varying(42),
    commander_since timestamp with time zone,
    vice_commander_since timestamp with time zone,
    announcement text DEFAULT ''::text,
    commander_pool_gp numeric(20,6) DEFAULT 0
);


ALTER TABLE public.commander OWNER TO jongho;

--
-- Name: commander_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.commander_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.commander_id_seq OWNER TO jongho;

--
-- Name: commander_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.commander_id_seq OWNED BY public.commander.id;


--
-- Name: crash_bets; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.crash_bets (
    id integer NOT NULL,
    round_id integer,
    wallet character varying(255) NOT NULL,
    bet_amount numeric(12,4) NOT NULL,
    currency character varying(4) DEFAULT 'PP'::character varying NOT NULL,
    cashout_at numeric(10,2),
    payout numeric(12,4) DEFAULT 0,
    status character varying(10) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT crash_bets_currency_check CHECK (((currency)::text = ANY ((ARRAY['PP'::character varying, 'USDT'::character varying])::text[]))),
    CONSTRAINT crash_bets_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'cashed'::character varying, 'busted'::character varying])::text[])))
);


ALTER TABLE public.crash_bets OWNER TO jongho;

--
-- Name: crash_bets_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.crash_bets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.crash_bets_id_seq OWNER TO jongho;

--
-- Name: crash_bets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.crash_bets_id_seq OWNED BY public.crash_bets.id;


--
-- Name: crash_rounds; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.crash_rounds (
    id integer NOT NULL,
    crash_point numeric(10,2) NOT NULL,
    hash character varying(64) NOT NULL,
    status character varying(10) DEFAULT 'waiting'::character varying NOT NULL,
    started_at timestamp with time zone,
    crashed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT crash_rounds_status_check CHECK (((status)::text = ANY ((ARRAY['waiting'::character varying, 'running'::character varying, 'crashed'::character varying])::text[])))
);


ALTER TABLE public.crash_rounds OWNER TO jongho;

--
-- Name: crash_rounds_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.crash_rounds_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.crash_rounds_id_seq OWNER TO jongho;

--
-- Name: crash_rounds_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.crash_rounds_id_seq OWNED BY public.crash_rounds.id;


--
-- Name: daily_logins; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.daily_logins (
    id integer NOT NULL,
    wallet character varying(42) NOT NULL,
    login_date date DEFAULT CURRENT_DATE NOT NULL,
    streak_day integer DEFAULT 1 NOT NULL,
    reward_gp numeric(20,6) DEFAULT 0,
    reward_pp numeric(20,6) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.daily_logins OWNER TO jongho;

--
-- Name: daily_logins_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.daily_logins_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.daily_logins_id_seq OWNER TO jongho;

--
-- Name: daily_logins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.daily_logins_id_seq OWNED BY public.daily_logins.id;


--
-- Name: daily_missions; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.daily_missions (
    id integer NOT NULL,
    wallet character varying(42) NOT NULL,
    mission_date date DEFAULT CURRENT_DATE NOT NULL,
    slot integer NOT NULL,
    mission_type character varying(30) NOT NULL,
    target_value integer DEFAULT 1 NOT NULL,
    current_value integer DEFAULT 0 NOT NULL,
    reward_gp numeric(20,6) DEFAULT 10 NOT NULL,
    reward_xp integer DEFAULT 5,
    completed boolean DEFAULT false,
    claimed boolean DEFAULT false,
    CONSTRAINT daily_missions_slot_check CHECK (((slot >= 1) AND (slot <= 3)))
);


ALTER TABLE public.daily_missions OWNER TO jongho;

--
-- Name: daily_missions_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.daily_missions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.daily_missions_id_seq OWNER TO jongho;

--
-- Name: daily_missions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.daily_missions_id_seq OWNED BY public.daily_missions.id;


--
-- Name: deposits; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.deposits (
    id integer NOT NULL,
    wallet_address character varying(42) NOT NULL,
    amount numeric(20,6) NOT NULL,
    pp_bonus numeric(20,6) NOT NULL,
    chain character varying(10) NOT NULL,
    tx_hash character varying(66) NOT NULL,
    block_number bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.deposits OWNER TO jongho;

--
-- Name: deposits_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.deposits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.deposits_id_seq OWNER TO jongho;

--
-- Name: deposits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.deposits_id_seq OWNED BY public.deposits.id;


--
-- Name: dice_games; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.dice_games (
    id integer NOT NULL,
    wallet character varying(42) NOT NULL,
    bet_amount numeric(20,6) NOT NULL,
    currency character varying(4) DEFAULT 'PP'::character varying,
    target integer NOT NULL,
    direction character varying(5) NOT NULL,
    roll integer NOT NULL,
    multiplier numeric(10,4),
    payout numeric(20,6) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.dice_games OWNER TO jongho;

--
-- Name: dice_games_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.dice_games_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.dice_games_id_seq OWNER TO jongho;

--
-- Name: dice_games_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.dice_games_id_seq OWNED BY public.dice_games.id;


--
-- Name: enhancement_log; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.enhancement_log (
    id integer NOT NULL,
    instance_id integer NOT NULL,
    wallet character varying(42) NOT NULL,
    from_level integer NOT NULL,
    to_level integer NOT NULL,
    success boolean NOT NULL,
    outcome character varying(20) NOT NULL,
    gp_cost numeric(20,6) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT enhancement_log_outcome_check CHECK (((outcome)::text = ANY ((ARRAY['success'::character varying, 'stay'::character varying, 'downgrade'::character varying, 'destroy'::character varying])::text[])))
);


ALTER TABLE public.enhancement_log OWNER TO jongho;

--
-- Name: enhancement_log_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.enhancement_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.enhancement_log_id_seq OWNER TO jongho;

--
-- Name: enhancement_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.enhancement_log_id_seq OWNED BY public.enhancement_log.id;


--
-- Name: events; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.events (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    type character varying(50) NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.events OWNER TO jongho;

--
-- Name: events_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.events_id_seq OWNER TO jongho;

--
-- Name: events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.events_id_seq OWNED BY public.events.id;


--
-- Name: exploration_pois; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.exploration_pois (
    id integer NOT NULL,
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    sector_id integer,
    poi_type character varying(30) NOT NULL,
    reward_type character varying(20) DEFAULT 'pp'::character varying NOT NULL,
    reward_amount double precision DEFAULT 0 NOT NULL,
    reward_item_code character varying(50),
    discovered_by character varying(42),
    discovered_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT exploration_pois_poi_type_check CHECK (((poi_type)::text = ANY ((ARRAY['ancient_ruins'::character varying, 'ore_deposit'::character varying, 'crashed_probe'::character varying, 'water_ice'::character varying, 'alien_artifact'::character varying])::text[]))),
    CONSTRAINT exploration_pois_reward_type_check CHECK (((reward_type)::text = ANY ((ARRAY['pp'::character varying, 'gp'::character varying, 'item'::character varying, 'xp'::character varying])::text[])))
);


ALTER TABLE public.exploration_pois OWNER TO jongho;

--
-- Name: exploration_pois_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.exploration_pois_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.exploration_pois_id_seq OWNER TO jongho;

--
-- Name: exploration_pois_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.exploration_pois_id_seq OWNED BY public.exploration_pois.id;


--
-- Name: game_items; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.game_items (
    id integer NOT NULL,
    slug character varying(100) NOT NULL,
    name character varying(200) NOT NULL,
    category character varying(50) NOT NULL,
    price_usdt numeric(20,6) DEFAULT 0,
    price_pp numeric(20,6) DEFAULT 0,
    config jsonb DEFAULT '{}'::jsonb,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.game_items OWNER TO jongho;

--
-- Name: game_items_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.game_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.game_items_id_seq OWNER TO jongho;

--
-- Name: game_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.game_items_id_seq OWNED BY public.game_items.id;


--
-- Name: global_events_gov; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.global_events_gov (
    id integer NOT NULL,
    event_type character varying(30) NOT NULL,
    triggered_by character varying(42) NOT NULL,
    gp_cost numeric(20,6) NOT NULL,
    starts_at timestamp with time zone DEFAULT now(),
    ends_at timestamp with time zone NOT NULL,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT global_events_gov_event_type_check CHECK (((event_type)::text = ANY ((ARRAY['double_mining'::character varying, 'war_time'::character varying, 'peace_treaty'::character varying])::text[])))
);


ALTER TABLE public.global_events_gov OWNER TO jongho;

--
-- Name: global_events_gov_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.global_events_gov_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.global_events_gov_id_seq OWNER TO jongho;

--
-- Name: global_events_gov_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.global_events_gov_id_seq OWNED BY public.global_events_gov.id;


--
-- Name: governance_history; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.governance_history (
    id integer NOT NULL,
    wallet character varying(42) NOT NULL,
    role character varying(20) NOT NULL,
    sector_id integer,
    started_at timestamp with time zone NOT NULL,
    ended_at timestamp with time zone,
    total_tax_earned numeric(14,2) DEFAULT 0,
    tenure_seconds integer DEFAULT 0
);


ALTER TABLE public.governance_history OWNER TO jongho;

--
-- Name: governance_history_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.governance_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.governance_history_id_seq OWNER TO jongho;

--
-- Name: governance_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.governance_history_id_seq OWNED BY public.governance_history.id;


--
-- Name: governance_positions; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.governance_positions (
    id integer NOT NULL,
    wallet character varying(42) NOT NULL,
    role character varying(20) NOT NULL,
    sector_id integer,
    gp_balance numeric(20,6) DEFAULT 0,
    appointed_at timestamp with time zone DEFAULT now(),
    CONSTRAINT governance_positions_role_check CHECK (((role)::text = ANY ((ARRAY['governor'::character varying, 'vice_governor'::character varying, 'commander'::character varying, 'vice_commander'::character varying])::text[])))
);


ALTER TABLE public.governance_positions OWNER TO jongho;

--
-- Name: governance_positions_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.governance_positions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.governance_positions_id_seq OWNER TO jongho;

--
-- Name: governance_positions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.governance_positions_id_seq OWNED BY public.governance_positions.id;


--
-- Name: governance_transactions; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.governance_transactions (
    id integer NOT NULL,
    type character varying(30) NOT NULL,
    from_role character varying(30),
    to_role character varying(30),
    sector_id integer,
    wallet character varying(42),
    gp_amount numeric(20,6),
    meta jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT gov_tx_type_check CHECK (((type)::text = ANY ((ARRAY['position_transfer'::character varying, 'tax_income'::character varying, 'pool_distribute'::character varying, 'maintenance'::character varying, 'buff_purchase'::character varying, 'event_spend'::character varying, 'bounty_spend'::character varying])::text[])))
);


ALTER TABLE public.governance_transactions OWNER TO jongho;

--
-- Name: governance_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.governance_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.governance_transactions_id_seq OWNER TO jongho;

--
-- Name: governance_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.governance_transactions_id_seq OWNED BY public.governance_transactions.id;


--
-- Name: governor_fees; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.governor_fees (
    id integer NOT NULL,
    sector_id integer NOT NULL,
    governor_wallet character varying(42) NOT NULL,
    pp_amount numeric(20,6) NOT NULL,
    trigger_type character varying(20) NOT NULL,
    trigger_tx_id integer,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.governor_fees OWNER TO jongho;

--
-- Name: governor_fees_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.governor_fees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.governor_fees_id_seq OWNER TO jongho;

--
-- Name: governor_fees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.governor_fees_id_seq OWNED BY public.governor_fees.id;


--
-- Name: governor_hall_of_fame; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.governor_hall_of_fame (
    id integer NOT NULL,
    user_wallet character varying(42) NOT NULL,
    sector_code character varying(30) NOT NULL,
    term_start timestamp without time zone NOT NULL,
    term_end timestamp without time zone,
    duration_days integer,
    total_tax_earned numeric(20,8) DEFAULT 0,
    ended_by character varying(30),
    max_tax_rate numeric(5,2),
    notable_event text
);


ALTER TABLE public.governor_hall_of_fame OWNER TO jongho;

--
-- Name: governor_hall_of_fame_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.governor_hall_of_fame_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.governor_hall_of_fame_id_seq OWNER TO jongho;

--
-- Name: governor_hall_of_fame_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.governor_hall_of_fame_id_seq OWNED BY public.governor_hall_of_fame.id;


--
-- Name: governor_sieges; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.governor_sieges (
    id integer NOT NULL,
    sector_code character varying(30) NOT NULL,
    challenger_wallet character varying(42) NOT NULL,
    defender_wallet character varying(42),
    status character varying(20) DEFAULT 'pending'::character varying,
    gp_cost integer DEFAULT 0 NOT NULL,
    declared_at timestamp without time zone DEFAULT now(),
    siege_starts_at timestamp without time zone,
    siege_ends_at timestamp without time zone,
    winner_wallet character varying(42),
    final_challenger_px integer DEFAULT 0,
    final_defender_px integer DEFAULT 0,
    participant_count integer DEFAULT 0,
    total_pp_volume numeric(20,8) DEFAULT 0,
    resolved_at timestamp without time zone,
    betting_event_id integer,
    CONSTRAINT governor_sieges_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'active'::character varying, 'resolved'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.governor_sieges OWNER TO jongho;

--
-- Name: governor_sieges_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.governor_sieges_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.governor_sieges_id_seq OWNER TO jongho;

--
-- Name: governor_sieges_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.governor_sieges_id_seq OWNED BY public.governor_sieges.id;


--
-- Name: guild_invites; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.guild_invites (
    id integer NOT NULL,
    guild_id integer NOT NULL,
    invited_wallet character varying(42) NOT NULL,
    invited_by character varying(42) NOT NULL,
    status character varying(10) DEFAULT 'pending'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT guild_invites_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'declined'::character varying, 'expired'::character varying])::text[])))
);


ALTER TABLE public.guild_invites OWNER TO jongho;

--
-- Name: guild_invites_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.guild_invites_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.guild_invites_id_seq OWNER TO jongho;

--
-- Name: guild_invites_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.guild_invites_id_seq OWNED BY public.guild_invites.id;


--
-- Name: guild_members; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.guild_members (
    guild_id integer NOT NULL,
    wallet character varying(42) NOT NULL,
    role character varying(10) DEFAULT 'member'::character varying NOT NULL,
    joined_at timestamp with time zone DEFAULT now(),
    pp_contribution_pct integer DEFAULT 5,
    total_contributed numeric(20,6) DEFAULT 0,
    gp_contribution_pct integer DEFAULT 5,
    CONSTRAINT guild_members_role_check CHECK (((role)::text = ANY ((ARRAY['leader'::character varying, 'officer'::character varying, 'member'::character varying])::text[])))
);


ALTER TABLE public.guild_members OWNER TO jongho;

--
-- Name: guild_messages; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.guild_messages (
    id integer NOT NULL,
    guild_id integer NOT NULL,
    wallet character varying(42) NOT NULL,
    nickname character varying(50) DEFAULT NULL::character varying,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.guild_messages OWNER TO jongho;

--
-- Name: guild_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.guild_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.guild_messages_id_seq OWNER TO jongho;

--
-- Name: guild_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.guild_messages_id_seq OWNED BY public.guild_messages.id;


--
-- Name: guild_raids; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.guild_raids (
    id integer NOT NULL,
    guild_id integer NOT NULL,
    target_wallet character varying(42) NOT NULL,
    target_lat double precision NOT NULL,
    target_lng double precision NOT NULL,
    declared_by character varying(42) NOT NULL,
    declared_at timestamp with time zone DEFAULT now(),
    participant_count integer DEFAULT 1,
    participants jsonb DEFAULT '[]'::jsonb,
    status character varying(16) DEFAULT 'forming'::character varying,
    result_json jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT guild_raids_status_check CHECK (((status)::text = ANY ((ARRAY['forming'::character varying, 'active'::character varying, 'complete'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.guild_raids OWNER TO jongho;

--
-- Name: guild_raids_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.guild_raids_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.guild_raids_id_seq OWNER TO jongho;

--
-- Name: guild_raids_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.guild_raids_id_seq OWNED BY public.guild_raids.id;


--
-- Name: guild_treasury_ledger; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.guild_treasury_ledger (
    id integer NOT NULL,
    guild_id integer NOT NULL,
    wallet character varying(42) DEFAULT NULL::character varying,
    kind character varying(24) NOT NULL,
    delta_pp numeric(20,6) NOT NULL,
    balance_after numeric(20,6) NOT NULL,
    memo text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now(),
    delta_gp numeric(20,6) DEFAULT 0
);


ALTER TABLE public.guild_treasury_ledger OWNER TO jongho;

--
-- Name: guild_treasury_ledger_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.guild_treasury_ledger_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.guild_treasury_ledger_id_seq OWNER TO jongho;

--
-- Name: guild_treasury_ledger_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.guild_treasury_ledger_id_seq OWNED BY public.guild_treasury_ledger.id;


--
-- Name: guild_war_actions; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.guild_war_actions (
    id integer NOT NULL,
    war_id integer NOT NULL,
    guild_id integer NOT NULL,
    wallet character varying(42) NOT NULL,
    action_type character varying(20) NOT NULL,
    points integer DEFAULT 0,
    meta jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.guild_war_actions OWNER TO jongho;

--
-- Name: guild_war_actions_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.guild_war_actions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.guild_war_actions_id_seq OWNER TO jongho;

--
-- Name: guild_war_actions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.guild_war_actions_id_seq OWNED BY public.guild_war_actions.id;


--
-- Name: guild_wars; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.guild_wars (
    id integer NOT NULL,
    attacker_guild_id integer NOT NULL,
    defender_guild_id integer NOT NULL,
    declared_by character varying(42) NOT NULL,
    status character varying(16) DEFAULT 'declared'::character varying NOT NULL,
    war_start timestamp with time zone,
    war_end timestamp with time zone,
    duration_hours integer DEFAULT 24,
    attacker_score integer DEFAULT 0,
    defender_score integer DEFAULT 0,
    winner_guild_id integer,
    reward_pp numeric(20,6) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT guild_wars_status_check CHECK (((status)::text = ANY ((ARRAY['declared'::character varying, 'active'::character varying, 'resolved'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.guild_wars OWNER TO jongho;

--
-- Name: guild_wars_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.guild_wars_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.guild_wars_id_seq OWNER TO jongho;

--
-- Name: guild_wars_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.guild_wars_id_seq OWNED BY public.guild_wars.id;


--
-- Name: guilds; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.guilds (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    tag character varying(4) NOT NULL,
    leader_wallet character varying(42) NOT NULL,
    description text DEFAULT ''::text,
    emblem_emoji character varying(10) DEFAULT '🔴'::character varying,
    member_count integer DEFAULT 1,
    total_pixels integer DEFAULT 0,
    gp_treasury numeric(20,6) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    emblem_image text,
    level integer DEFAULT 1,
    pp_treasury numeric(20,6) DEFAULT 0,
    research_flags jsonb DEFAULT '{}'::jsonb,
    raid_count integer DEFAULT 0,
    last_raid_at timestamp with time zone
);


ALTER TABLE public.guilds OWNER TO jongho;

--
-- Name: guilds_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.guilds_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.guilds_id_seq OWNER TO jongho;

--
-- Name: guilds_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.guilds_id_seq OWNED BY public.guilds.id;


--
-- Name: hall_of_fame; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.hall_of_fame (
    id integer NOT NULL,
    category character varying(60) NOT NULL,
    user_wallet character varying(42),
    guild_id integer,
    sector_code character varying(30),
    value_numeric numeric(20,8),
    description_en text,
    description_ko text,
    description_ja text,
    description_zh text,
    achieved_at timestamp without time zone DEFAULT now(),
    season_id integer,
    is_all_time boolean DEFAULT false,
    is_featured boolean DEFAULT false
);


ALTER TABLE public.hall_of_fame OWNER TO jongho;

--
-- Name: hall_of_fame_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.hall_of_fame_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.hall_of_fame_id_seq OWNER TO jongho;

--
-- Name: hall_of_fame_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.hall_of_fame_id_seq OWNED BY public.hall_of_fame.id;


--
-- Name: hilo_games; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.hilo_games (
    id integer NOT NULL,
    wallet character varying(42) NOT NULL,
    bet_amount numeric(20,6) NOT NULL,
    currency character varying(4) DEFAULT 'PP'::character varying,
    status character varying(10) DEFAULT 'active'::character varying,
    cards jsonb DEFAULT '[]'::jsonb,
    current_multiplier numeric(10,4) DEFAULT 1,
    payout numeric(20,6) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.hilo_games OWNER TO jongho;

--
-- Name: hilo_games_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.hilo_games_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.hilo_games_id_seq OWNER TO jongho;

--
-- Name: hilo_games_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.hilo_games_id_seq OWNED BY public.hilo_games.id;


--
-- Name: item_instances; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.item_instances (
    id integer NOT NULL,
    wallet character varying(42) NOT NULL,
    item_type_id integer NOT NULL,
    enhancement_level integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT item_instances_enhancement_level_check CHECK (((enhancement_level >= 0) AND (enhancement_level <= 10)))
);


ALTER TABLE public.item_instances OWNER TO jongho;

--
-- Name: item_instances_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.item_instances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.item_instances_id_seq OWNER TO jongho;

--
-- Name: item_instances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.item_instances_id_seq OWNED BY public.item_instances.id;


--
-- Name: item_types; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.item_types (
    id integer NOT NULL,
    code character varying(20) NOT NULL,
    name character varying(50) NOT NULL,
    description text,
    category character varying(20) DEFAULT 'battle'::character varying NOT NULL,
    price_pp numeric(20,6) DEFAULT 0 NOT NULL,
    price_usdt numeric(20,6) DEFAULT 0 NOT NULL,
    duration_hours integer DEFAULT 0,
    effect_value integer DEFAULT 0,
    icon character varying(10) DEFAULT ''::character varying,
    max_stack integer DEFAULT 5,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    price_gp numeric(20,6) DEFAULT 0 NOT NULL
);


ALTER TABLE public.item_types OWNER TO jongho;

--
-- Name: item_types_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.item_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.item_types_id_seq OWNER TO jongho;

--
-- Name: item_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.item_types_id_seq OWNED BY public.item_types.id;


--
-- Name: item_usage_log; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.item_usage_log (
    id integer NOT NULL,
    wallet character varying(42) NOT NULL,
    item_type_id integer,
    claim_id integer,
    used_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.item_usage_log OWNER TO jongho;

--
-- Name: item_usage_log_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.item_usage_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.item_usage_log_id_seq OWNER TO jongho;

--
-- Name: item_usage_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.item_usage_log_id_seq OWNED BY public.item_usage_log.id;


--
-- Name: job_buffs; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.job_buffs (
    id integer NOT NULL,
    job_id integer NOT NULL,
    buff_key character varying(60) NOT NULL,
    buff_value numeric(8,4) NOT NULL,
    description text,
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.job_buffs OWNER TO jongho;

--
-- Name: job_buffs_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.job_buffs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.job_buffs_id_seq OWNER TO jongho;

--
-- Name: job_buffs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.job_buffs_id_seq OWNED BY public.job_buffs.id;


--
-- Name: job_change_log; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.job_change_log (
    id integer NOT NULL,
    user_id character varying(42) NOT NULL,
    from_job_id integer,
    to_job_id integer NOT NULL,
    change_type character varying(20) DEFAULT 'free'::character varying,
    gp_cost integer DEFAULT 0,
    changed_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.job_change_log OWNER TO jongho;

--
-- Name: job_change_log_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.job_change_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.job_change_log_id_seq OWNER TO jongho;

--
-- Name: job_change_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.job_change_log_id_seq OWNED BY public.job_change_log.id;


--
-- Name: jobs; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.jobs (
    id integer NOT NULL,
    code character varying(20) NOT NULL,
    name_en character varying(50) NOT NULL,
    name_ko character varying(50) NOT NULL,
    name_ja character varying(50) NOT NULL,
    name_zh character varying(50) NOT NULL,
    description_en text,
    description_ko text,
    description_ja text,
    description_zh text,
    icon_emoji character varying(10) DEFAULT '⚔️'::character varying,
    color_hex character varying(7) DEFAULT '#888888'::character varying,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.jobs OWNER TO jongho;

--
-- Name: jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.jobs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.jobs_id_seq OWNER TO jongho;

--
-- Name: jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.jobs_id_seq OWNED BY public.jobs.id;


--
-- Name: loading_lore; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.loading_lore (
    id integer NOT NULL,
    year character varying(10) DEFAULT 'TIP'::character varying NOT NULL,
    text_en text NOT NULL,
    text_ko text,
    text_ja text,
    text_zh text,
    category character varying(30) DEFAULT 'timeline'::character varying,
    sort_order integer DEFAULT 0,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.loading_lore OWNER TO jongho;

--
-- Name: loading_lore_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.loading_lore_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.loading_lore_id_seq OWNER TO jongho;

--
-- Name: loading_lore_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.loading_lore_id_seq OWNED BY public.loading_lore.id;


--
-- Name: loot_priority_claims; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.loot_priority_claims (
    id integer NOT NULL,
    wallet character varying(42) NOT NULL,
    rocket_event_id integer NOT NULL,
    purchased_at timestamp with time zone DEFAULT now(),
    notified_at timestamp with time zone
);


ALTER TABLE public.loot_priority_claims OWNER TO jongho;

--
-- Name: loot_priority_claims_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.loot_priority_claims_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.loot_priority_claims_id_seq OWNER TO jongho;

--
-- Name: loot_priority_claims_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.loot_priority_claims_id_seq OWNED BY public.loot_priority_claims.id;


--
-- Name: lore_crawl; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.lore_crawl (
    id integer NOT NULL,
    lang character varying(5) DEFAULT 'en'::character varying NOT NULL,
    era_text text,
    title_text text DEFAULT 'OCCUPY MARS'::text,
    body_html text,
    tagline text,
    close_text text DEFAULT 'ENTER MARS'::text,
    active boolean DEFAULT true,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.lore_crawl OWNER TO jongho;

--
-- Name: lore_crawl_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.lore_crawl_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lore_crawl_id_seq OWNER TO jongho;

--
-- Name: lore_crawl_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.lore_crawl_id_seq OWNED BY public.lore_crawl.id;


--
-- Name: maintenance_log; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.maintenance_log (
    id integer NOT NULL,
    wallet character varying(42) NOT NULL,
    total_pixels integer NOT NULL,
    fee_amount numeric(20,6) DEFAULT 0 NOT NULL,
    pixels_abandoned integer DEFAULT 0 NOT NULL,
    processed_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.maintenance_log OWNER TO jongho;

--
-- Name: maintenance_log_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.maintenance_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.maintenance_log_id_seq OWNER TO jongho;

--
-- Name: maintenance_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.maintenance_log_id_seq OWNED BY public.maintenance_log.id;


--
-- Name: marketplace_listings; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.marketplace_listings (
    id integer NOT NULL,
    seller character varying(42) NOT NULL,
    listing_type character varying(20) NOT NULL,
    item_instance_id integer,
    claim_id integer,
    price numeric(20,6) NOT NULL,
    currency character varying(4) DEFAULT 'GP'::character varying NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    listed_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    buyer character varying(42),
    sold_at timestamp with time zone,
    meta jsonb DEFAULT '{}'::jsonb,
    resource_code character varying(30),
    resource_quantity integer DEFAULT 1,
    CONSTRAINT marketplace_listings_currency_check CHECK (((currency)::text = ANY ((ARRAY['GP'::character varying, 'PP'::character varying])::text[]))),
    CONSTRAINT marketplace_listings_listing_type_check CHECK (((listing_type)::text = ANY ((ARRAY['item'::character varying, 'cosmetic'::character varying, 'claim'::character varying, 'resource'::character varying])::text[]))),
    CONSTRAINT marketplace_listings_price_check CHECK ((price > (0)::numeric)),
    CONSTRAINT marketplace_listings_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'sold'::character varying, 'cancelled'::character varying, 'expired'::character varying, 'moderated'::character varying])::text[])))
);


ALTER TABLE public.marketplace_listings OWNER TO jongho;

--
-- Name: marketplace_listings_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.marketplace_listings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.marketplace_listings_id_seq OWNER TO jongho;

--
-- Name: marketplace_listings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.marketplace_listings_id_seq OWNED BY public.marketplace_listings.id;


--
-- Name: marketplace_price_history; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.marketplace_price_history (
    id integer NOT NULL,
    listing_type character varying(20) NOT NULL,
    item_type_id integer,
    enhancement_level integer DEFAULT 0,
    claim_id integer,
    sale_price numeric(20,6) NOT NULL,
    currency character varying(4) DEFAULT 'GP'::character varying NOT NULL,
    sold_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.marketplace_price_history OWNER TO jongho;

--
-- Name: marketplace_price_history_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.marketplace_price_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.marketplace_price_history_id_seq OWNER TO jongho;

--
-- Name: marketplace_price_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.marketplace_price_history_id_seq OWNED BY public.marketplace_price_history.id;


--
-- Name: mars_weather; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.mars_weather (
    id integer NOT NULL,
    sector_id integer NOT NULL,
    weather_type character varying(30) NOT NULL,
    effects jsonb DEFAULT '{}'::jsonb NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT mars_weather_weather_type_check CHECK (((weather_type)::text = ANY ((ARRAY['sandstorm'::character varying, 'solar_flare'::character varying, 'meteor_shower'::character varying, 'dust_devil'::character varying])::text[])))
);


ALTER TABLE public.mars_weather OWNER TO jongho;

--
-- Name: mars_weather_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.mars_weather_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.mars_weather_id_seq OWNER TO jongho;

--
-- Name: mars_weather_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.mars_weather_id_seq OWNED BY public.mars_weather.id;


--
-- Name: mines_games; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.mines_games (
    id integer NOT NULL,
    wallet character varying(255) NOT NULL,
    bet_amount numeric(12,4) NOT NULL,
    currency character varying(4) DEFAULT 'PP'::character varying NOT NULL,
    mine_count integer DEFAULT 5 NOT NULL,
    grid text NOT NULL,
    revealed text DEFAULT '[]'::text NOT NULL,
    current_multiplier numeric(10,4) DEFAULT 1.0 NOT NULL,
    status character varying(10) DEFAULT 'active'::character varying NOT NULL,
    payout numeric(12,4) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    ended_at timestamp with time zone,
    CONSTRAINT mines_games_currency_check CHECK (((currency)::text = ANY ((ARRAY['PP'::character varying, 'USDT'::character varying])::text[]))),
    CONSTRAINT mines_games_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'cashed'::character varying, 'busted'::character varying])::text[])))
);


ALTER TABLE public.mines_games OWNER TO jongho;

--
-- Name: mines_games_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.mines_games_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.mines_games_id_seq OWNER TO jongho;

--
-- Name: mines_games_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.mines_games_id_seq OWNED BY public.mines_games.id;


--
-- Name: missions; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.missions (
    id integer NOT NULL,
    wallet character varying(42) NOT NULL,
    type character varying(16) NOT NULL,
    origin_lat double precision NOT NULL,
    origin_lng double precision NOT NULL,
    target_lat double precision NOT NULL,
    target_lng double precision NOT NULL,
    target_wallet character varying(42) DEFAULT NULL::character varying,
    distance_deg double precision NOT NULL,
    start_time timestamp with time zone DEFAULT now() NOT NULL,
    duration_sec integer NOT NULL,
    launch_cost_pp numeric(18,6) DEFAULT 0 NOT NULL,
    status character varying(16) DEFAULT 'traveling'::character varying NOT NULL,
    success boolean,
    reward_json jsonb DEFAULT '{}'::jsonb,
    claimed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    origin_claim_id integer,
    reward_multiplier numeric(6,3) DEFAULT 1.0 NOT NULL,
    CONSTRAINT missions_status_check CHECK (((status)::text = ANY ((ARRAY['traveling'::character varying, 'complete'::character varying, 'claimed'::character varying, 'failed'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT missions_type_check CHECK (((type)::text = ANY ((ARRAY['invasion'::character varying, 'exploration'::character varying])::text[])))
);


ALTER TABLE public.missions OWNER TO jongho;

--
-- Name: missions_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.missions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.missions_id_seq OWNER TO jongho;

--
-- Name: missions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.missions_id_seq OWNED BY public.missions.id;


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.password_reset_tokens (
    id integer NOT NULL,
    email character varying(254) NOT NULL,
    token character varying(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.password_reset_tokens OWNER TO jongho;

--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.password_reset_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.password_reset_tokens_id_seq OWNER TO jongho;

--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.password_reset_tokens_id_seq OWNED BY public.password_reset_tokens.id;


--
-- Name: pixel_shields; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.pixel_shields (
    id integer NOT NULL,
    claim_id integer NOT NULL,
    owner character varying(42) NOT NULL,
    shield_type character varying(20) DEFAULT 'basic'::character varying NOT NULL,
    hp integer DEFAULT 100 NOT NULL,
    max_hp integer DEFAULT 100 NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    auto_renew boolean DEFAULT false
);


ALTER TABLE public.pixel_shields OWNER TO jongho;

--
-- Name: pixel_shields_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.pixel_shields_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pixel_shields_id_seq OWNER TO jongho;

--
-- Name: pixel_shields_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.pixel_shields_id_seq OWNED BY public.pixel_shields.id;


--
-- Name: pixels; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.pixels (
    lat numeric(8,2) NOT NULL,
    lng numeric(8,2) NOT NULL,
    owner character varying(42),
    price numeric(20,6) DEFAULT 0.1,
    claim_id integer,
    updated_at timestamp with time zone DEFAULT now(),
    sector_id integer
);


ALTER TABLE public.pixels OWNER TO jongho;

--
-- Name: poi_discoveries; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.poi_discoveries (
    id integer NOT NULL,
    poi_id integer NOT NULL,
    wallet character varying(42) NOT NULL,
    reward_type character varying(20) NOT NULL,
    reward_amount double precision DEFAULT 0 NOT NULL,
    reward_item_code character varying(50),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT poi_discoveries_reward_type_check CHECK (((reward_type)::text = ANY ((ARRAY['pp'::character varying, 'gp'::character varying, 'item'::character varying, 'xp'::character varying])::text[])))
);


ALTER TABLE public.poi_discoveries OWNER TO jongho;

--
-- Name: poi_discoveries_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.poi_discoveries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.poi_discoveries_id_seq OWNER TO jongho;

--
-- Name: poi_discoveries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.poi_discoveries_id_seq OWNED BY public.poi_discoveries.id;


--
-- Name: poi_drop_table; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.poi_drop_table (
    id integer NOT NULL,
    item_code character varying(30) NOT NULL,
    item_name character varying(60) NOT NULL,
    icon character varying(10) DEFAULT '📦'::character varying,
    weight integer DEFAULT 10 NOT NULL,
    min_qty integer DEFAULT 1 NOT NULL,
    max_qty integer DEFAULT 1 NOT NULL,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.poi_drop_table OWNER TO jongho;

--
-- Name: poi_drop_table_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.poi_drop_table_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.poi_drop_table_id_seq OWNER TO jongho;

--
-- Name: poi_drop_table_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.poi_drop_table_id_seq OWNED BY public.poi_drop_table.id;


--
-- Name: quest_definitions; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.quest_definitions (
    id integer NOT NULL,
    type character varying(20) NOT NULL,
    title character varying(200) NOT NULL,
    description text,
    criteria jsonb DEFAULT '{}'::jsonb NOT NULL,
    reward_pp numeric(20,6) DEFAULT 0,
    reward_xp integer DEFAULT 0,
    active boolean DEFAULT true,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT quest_definitions_type_check CHECK (((type)::text = ANY ((ARRAY['daily'::character varying, 'weekly'::character varying, 'sector'::character varying, 'achievement'::character varying, 'event'::character varying])::text[])))
);


ALTER TABLE public.quest_definitions OWNER TO jongho;

--
-- Name: quest_definitions_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.quest_definitions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.quest_definitions_id_seq OWNER TO jongho;

--
-- Name: quest_definitions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.quest_definitions_id_seq OWNED BY public.quest_definitions.id;


--
-- Name: quest_reward_pool; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.quest_reward_pool (
    id integer DEFAULT 1 NOT NULL,
    balance numeric(14,4) DEFAULT 0 NOT NULL,
    total_funded numeric(14,4) DEFAULT 0 NOT NULL,
    total_paid numeric(14,4) DEFAULT 0 NOT NULL,
    today_paid numeric(14,4) DEFAULT 0 NOT NULL,
    today_date date DEFAULT CURRENT_DATE NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT quest_reward_pool_id_check CHECK ((id = 1))
);


ALTER TABLE public.quest_reward_pool OWNER TO jongho;

--
-- Name: quest_templates; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.quest_templates (
    id integer NOT NULL,
    tier character varying(10) NOT NULL,
    quest_type character varying(30) NOT NULL,
    title_template text NOT NULL,
    description_template text NOT NULL,
    requirement_type character varying(30) NOT NULL,
    requirement_min numeric DEFAULT 1 NOT NULL,
    requirement_max numeric DEFAULT 1 NOT NULL,
    reward_pp_min numeric(12,4) DEFAULT 1 NOT NULL,
    reward_pp_max numeric(12,4) DEFAULT 10 NOT NULL,
    cooldown_hours integer DEFAULT 24 NOT NULL,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT quest_templates_tier_check CHECK (((tier)::text = ANY ((ARRAY['free'::character varying, 'activity'::character varying, 'spending'::character varying])::text[])))
);


ALTER TABLE public.quest_templates OWNER TO jongho;

--
-- Name: quest_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.quest_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.quest_templates_id_seq OWNER TO jongho;

--
-- Name: quest_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.quest_templates_id_seq OWNED BY public.quest_templates.id;


--
-- Name: rank_definitions; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.rank_definitions (
    level integer NOT NULL,
    name character varying(100) NOT NULL,
    required_xp integer NOT NULL,
    reward_pp numeric(20,6) DEFAULT 0,
    breakthrough boolean DEFAULT false,
    breakthrough_condition jsonb
);


ALTER TABLE public.rank_definitions OWNER TO jongho;

--
-- Name: referral_rewards; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.referral_rewards (
    id integer NOT NULL,
    from_wallet character varying(42) NOT NULL,
    to_wallet character varying(42) NOT NULL,
    tier integer NOT NULL,
    pp_amount numeric(20,6) NOT NULL,
    trigger_type character varying(20) NOT NULL,
    trigger_tx_id integer,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.referral_rewards OWNER TO jongho;

--
-- Name: referral_rewards_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.referral_rewards_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.referral_rewards_id_seq OWNER TO jongho;

--
-- Name: referral_rewards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.referral_rewards_id_seq OWNED BY public.referral_rewards.id;


--
-- Name: resources; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.resources (
    id integer NOT NULL,
    code character varying(30) NOT NULL,
    name_en character varying(50),
    name_ko character varying(50),
    name_ja character varying(50),
    name_zh character varying(50),
    rarity character varying(20) DEFAULT 'common'::character varying,
    icon_emoji character varying(10),
    base_pp_value numeric(10,2) DEFAULT 1.0,
    is_tradeable boolean DEFAULT true,
    is_active boolean DEFAULT true
);


ALTER TABLE public.resources OWNER TO jongho;

--
-- Name: resources_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.resources_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.resources_id_seq OWNER TO jongho;

--
-- Name: resources_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.resources_id_seq OWNED BY public.resources.id;


--
-- Name: rocket_events; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.rocket_events (
    id integer NOT NULL,
    landing_lat double precision NOT NULL,
    landing_lng double precision NOT NULL,
    sector_id integer,
    event_type character varying(20) DEFAULT 'supply_drop'::character varying NOT NULL,
    status character varying(20) DEFAULT 'incoming'::character varying NOT NULL,
    scheduled_at timestamp with time zone DEFAULT now() NOT NULL,
    landing_at timestamp with time zone NOT NULL,
    looting_ends_at timestamp with time zone,
    rewards_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    total_rewards integer DEFAULT 0 NOT NULL,
    claimed_rewards integer DEFAULT 0 NOT NULL,
    triggered_by character varying(42),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT rocket_events_event_type_check CHECK (((event_type)::text = ANY ((ARRAY['supply_drop'::character varying, 'rud_explosion'::character varying])::text[]))),
    CONSTRAINT rocket_events_status_check CHECK (((status)::text = ANY ((ARRAY['incoming'::character varying, 'landed'::character varying, 'looting'::character varying, 'completed'::character varying])::text[])))
);


ALTER TABLE public.rocket_events OWNER TO jongho;

--
-- Name: rocket_events_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.rocket_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.rocket_events_id_seq OWNER TO jongho;

--
-- Name: rocket_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.rocket_events_id_seq OWNED BY public.rocket_events.id;


--
-- Name: rocket_loot_claims; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.rocket_loot_claims (
    id integer NOT NULL,
    rocket_event_id integer NOT NULL,
    wallet character varying(42) NOT NULL,
    loot_index integer NOT NULL,
    reward_type character varying(20) DEFAULT 'pp'::character varying NOT NULL,
    reward_amount double precision DEFAULT 0 NOT NULL,
    reward_item_code character varying(50),
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.rocket_loot_claims OWNER TO jongho;

--
-- Name: rocket_loot_claims_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.rocket_loot_claims_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.rocket_loot_claims_id_seq OWNER TO jongho;

--
-- Name: rocket_loot_claims_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.rocket_loot_claims_id_seq OWNED BY public.rocket_loot_claims.id;


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.schema_migrations (
    id integer NOT NULL,
    filename character varying(255) NOT NULL,
    applied_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.schema_migrations OWNER TO jongho;

--
-- Name: schema_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.schema_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.schema_migrations_id_seq OWNER TO jongho;

--
-- Name: schema_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.schema_migrations_id_seq OWNED BY public.schema_migrations.id;


--
-- Name: season_pass_claims; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.season_pass_claims (
    id integer NOT NULL,
    season_id integer NOT NULL,
    wallet character varying(42) NOT NULL,
    tier integer NOT NULL,
    is_premium boolean DEFAULT false,
    claimed_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.season_pass_claims OWNER TO jongho;

--
-- Name: season_pass_claims_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.season_pass_claims_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.season_pass_claims_id_seq OWNER TO jongho;

--
-- Name: season_pass_claims_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.season_pass_claims_id_seq OWNED BY public.season_pass_claims.id;


--
-- Name: season_pass_progress; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.season_pass_progress (
    season_id integer NOT NULL,
    wallet character varying(42) NOT NULL,
    pass_xp integer DEFAULT 0,
    current_tier integer DEFAULT 0,
    is_premium boolean DEFAULT false,
    purchased_at timestamp with time zone
);


ALTER TABLE public.season_pass_progress OWNER TO jongho;

--
-- Name: season_pass_tiers; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.season_pass_tiers (
    id integer NOT NULL,
    season_id integer NOT NULL,
    tier integer NOT NULL,
    is_premium boolean DEFAULT false,
    reward_type character varying(20) NOT NULL,
    reward_amount numeric(20,6) DEFAULT 0,
    reward_meta jsonb DEFAULT '{}'::jsonb,
    xp_required integer NOT NULL
);


ALTER TABLE public.season_pass_tiers OWNER TO jongho;

--
-- Name: season_pass_tiers_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.season_pass_tiers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.season_pass_tiers_id_seq OWNER TO jongho;

--
-- Name: season_pass_tiers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.season_pass_tiers_id_seq OWNED BY public.season_pass_tiers.id;


--
-- Name: season_rewards; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.season_rewards (
    id integer NOT NULL,
    season_id integer NOT NULL,
    wallet character varying(42) NOT NULL,
    rank integer NOT NULL,
    reward_type character varying(20) DEFAULT 'pp'::character varying NOT NULL,
    reward_amount numeric(20,6) DEFAULT 0,
    reward_meta jsonb DEFAULT '{}'::jsonb,
    claimed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT season_rewards_reward_type_check CHECK (((reward_type)::text = ANY ((ARRAY['pp'::character varying, 'gp'::character varying, 'usdt'::character varying, 'xp'::character varying, 'item'::character varying, 'cosmetic'::character varying, 'title'::character varying])::text[])))
);


ALTER TABLE public.season_rewards OWNER TO jongho;

--
-- Name: season_rewards_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.season_rewards_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.season_rewards_id_seq OWNER TO jongho;

--
-- Name: season_rewards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.season_rewards_id_seq OWNED BY public.season_rewards.id;


--
-- Name: season_scores; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.season_scores (
    id integer NOT NULL,
    season_id integer NOT NULL,
    wallet character varying(42) NOT NULL,
    score integer DEFAULT 0,
    pixels_claimed integer DEFAULT 0,
    harvests integer DEFAULT 0,
    hijacks_won integer DEFAULT 0,
    pois_discovered integer DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now(),
    tap_count integer DEFAULT 0,
    battles_lost integer DEFAULT 0,
    items_used integer DEFAULT 0,
    quests_done integer DEFAULT 0,
    gp_spent integer DEFAULT 0,
    pp_spent numeric(20,6) DEFAULT 0,
    shields_placed integer DEFAULT 0,
    sectors_entered integer DEFAULT 0,
    login_days integer DEFAULT 0,
    cosmetics_equipped integer DEFAULT 0,
    cantina_plays integer DEFAULT 0,
    guild_contributions integer DEFAULT 0,
    referrals integer DEFAULT 0,
    chat_messages integer DEFAULT 0,
    total_gp_earned integer DEFAULT 0,
    total_pp_earned numeric(20,6) DEFAULT 0,
    pixels_lost integer DEFAULT 0,
    longest_streak integer DEFAULT 0,
    rockets_joined integer DEFAULT 0,
    weather_checks integer DEFAULT 0,
    territory_renames integer DEFAULT 0,
    shares_count integer DEFAULT 0
);


ALTER TABLE public.season_scores OWNER TO jongho;

--
-- Name: season_scores_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.season_scores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.season_scores_id_seq OWNER TO jongho;

--
-- Name: season_scores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.season_scores_id_seq OWNED BY public.season_scores.id;


--
-- Name: seasons; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.seasons (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    theme character varying(20) DEFAULT 'volcanic'::character varying NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    active boolean DEFAULT false,
    rewards_json jsonb DEFAULT '[]'::jsonb,
    weather_weights jsonb DEFAULT '{}'::jsonb,
    visual_tint character varying(40) DEFAULT 'rgba(255,80,30,0.06)'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    active_categories jsonb DEFAULT '["overall", "territory", "mining", "combat", "explorer", "active"]'::jsonb,
    CONSTRAINT seasons_theme_check CHECK (((theme)::text = ANY ((ARRAY['volcanic'::character varying, 'ice_age'::character varying, 'solar_storm'::character varying, 'dust_epoch'::character varying])::text[])))
);


ALTER TABLE public.seasons OWNER TO jongho;

--
-- Name: seasons_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.seasons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.seasons_id_seq OWNER TO jongho;

--
-- Name: seasons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.seasons_id_seq OWNED BY public.seasons.id;


--
-- Name: sector_buffs; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.sector_buffs (
    id integer NOT NULL,
    sector_id integer NOT NULL,
    buff_type character varying(30) NOT NULL,
    effect_value numeric(6,2) NOT NULL,
    gp_cost numeric(20,6) NOT NULL,
    activated_by character varying(42) NOT NULL,
    activated_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    active boolean DEFAULT true,
    CONSTRAINT sector_buffs_buff_type_check CHECK (((buff_type)::text = ANY ((ARRAY['mining_boost'::character varying, 'defense_bonus'::character varying, 'claim_discount'::character varying])::text[])))
);


ALTER TABLE public.sector_buffs OWNER TO jongho;

--
-- Name: sector_buffs_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.sector_buffs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sector_buffs_id_seq OWNER TO jongho;

--
-- Name: sector_buffs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.sector_buffs_id_seq OWNED BY public.sector_buffs.id;


--
-- Name: sector_definitions; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.sector_definitions (
    id integer NOT NULL,
    code character varying(30) NOT NULL,
    name_en character varying(50),
    name_ko character varying(50),
    name_ja character varying(50),
    name_zh character varying(50),
    sector_type character varying(20) NOT NULL,
    price_multiplier numeric(5,2) DEFAULT 1.0,
    mining_multiplier numeric(5,2) DEFAULT 1.0,
    defense_multiplier numeric(5,2) DEFAULT 1.0,
    center_x integer,
    center_y integer,
    lore_en text,
    lore_ko text,
    lore_ja text,
    lore_zh text,
    special_feature text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.sector_definitions OWNER TO jongho;

--
-- Name: sector_definitions_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.sector_definitions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sector_definitions_id_seq OWNER TO jongho;

--
-- Name: sector_definitions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.sector_definitions_id_seq OWNED BY public.sector_definitions.id;


--
-- Name: sector_entry_requirements; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.sector_entry_requirements (
    id integer NOT NULL,
    sector_code character varying(30) NOT NULL,
    min_level integer DEFAULT 0,
    required_mid_territories integer DEFAULT 0,
    is_active boolean DEFAULT true
);


ALTER TABLE public.sector_entry_requirements OWNER TO jongho;

--
-- Name: sector_entry_requirements_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.sector_entry_requirements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sector_entry_requirements_id_seq OWNER TO jongho;

--
-- Name: sector_entry_requirements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.sector_entry_requirements_id_seq OWNED BY public.sector_entry_requirements.id;


--
-- Name: sector_governance; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.sector_governance (
    id integer NOT NULL,
    sector_code character varying(30) NOT NULL,
    governor_wallet character varying(42),
    governor_since timestamp without time zone,
    tax_rate numeric(5,2) DEFAULT 2.0,
    market_cut_rate numeric(5,4) DEFAULT 0.01,
    sector_policy character varying(20) DEFAULT 'open'::character varying,
    declaration_text text,
    declaration_updated timestamp without time zone,
    total_tax_collected numeric(20,8) DEFAULT 0,
    active_siege_id integer,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.sector_governance OWNER TO jongho;

--
-- Name: sector_governance_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.sector_governance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sector_governance_id_seq OWNER TO jongho;

--
-- Name: sector_governance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.sector_governance_id_seq OWNED BY public.sector_governance.id;


--
-- Name: sector_resource_rates; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.sector_resource_rates (
    id integer NOT NULL,
    sector_type character varying(20) NOT NULL,
    resource_code character varying(30) NOT NULL,
    base_rate numeric(6,4) NOT NULL,
    miner_bonus numeric(6,4) DEFAULT 0,
    is_active boolean DEFAULT true
);


ALTER TABLE public.sector_resource_rates OWNER TO jongho;

--
-- Name: sector_resource_rates_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.sector_resource_rates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sector_resource_rates_id_seq OWNER TO jongho;

--
-- Name: sector_resource_rates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.sector_resource_rates_id_seq OWNED BY public.sector_resource_rates.id;


--
-- Name: sectors; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.sectors (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    tier character varying(20) NOT NULL,
    center_lat numeric(8,2) NOT NULL,
    center_lng numeric(8,2) NOT NULL,
    lat_min numeric(8,2) NOT NULL,
    lat_max numeric(8,2) NOT NULL,
    lng_min numeric(8,2) NOT NULL,
    lng_max numeric(8,2) NOT NULL,
    base_price numeric(20,6) DEFAULT 0.02,
    governor_wallet character varying(42),
    governor_since timestamp with time zone,
    total_pixels integer DEFAULT 0,
    occupied_pixels integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    bounds_polygon jsonb,
    tax_rate numeric(4,2) DEFAULT 2.00,
    vice_governor_wallet character varying(42),
    vice_governor_since timestamp with time zone,
    announcement text DEFAULT ''::text,
    sector_pool_gp numeric(20,6) DEFAULT 0,
    buff_fund_gp numeric(20,6) DEFAULT 0,
    CONSTRAINT sectors_tier_check CHECK (((tier)::text = ANY ((ARRAY['core'::character varying, 'mid'::character varying, 'frontier'::character varying])::text[])))
);


ALTER TABLE public.sectors OWNER TO jongho;

--
-- Name: sectors_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.sectors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sectors_id_seq OWNER TO jongho;

--
-- Name: sectors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.sectors_id_seq OWNED BY public.sectors.id;


--
-- Name: server_chronicles; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.server_chronicles (
    id integer NOT NULL,
    event_type character varying(50) NOT NULL,
    actor_wallet character varying(42),
    target_wallet character varying(42),
    guild_id integer,
    sector_code character varying(30),
    value_pp numeric(20,8),
    value_gp numeric(20,8),
    extra_data jsonb DEFAULT '{}'::jsonb,
    title_en character varying(300),
    title_ko character varying(300),
    title_ja character varying(300),
    title_zh character varying(300),
    body_en text,
    is_public boolean DEFAULT true,
    webhook_sent boolean DEFAULT false,
    occurred_at timestamp without time zone DEFAULT now(),
    season_id integer
);


ALTER TABLE public.server_chronicles OWNER TO jongho;

--
-- Name: server_chronicles_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.server_chronicles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.server_chronicles_id_seq OWNER TO jongho;

--
-- Name: server_chronicles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.server_chronicles_id_seq OWNED BY public.server_chronicles.id;


--
-- Name: settings; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.settings (
    key character varying(100) NOT NULL,
    value jsonb NOT NULL,
    description text,
    category character varying(50) DEFAULT 'general'::character varying,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.settings OWNER TO jongho;

--
-- Name: starlink_passes; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.starlink_passes (
    id integer NOT NULL,
    satellite_id integer NOT NULL,
    sector_id integer NOT NULL,
    boost_value double precision DEFAULT 0.1 NOT NULL,
    started_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.starlink_passes OWNER TO jongho;

--
-- Name: starlink_passes_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.starlink_passes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.starlink_passes_id_seq OWNER TO jongho;

--
-- Name: starlink_passes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.starlink_passes_id_seq OWNED BY public.starlink_passes.id;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.transactions (
    id integer NOT NULL,
    type character varying(20) NOT NULL,
    from_wallet character varying(42),
    to_wallet character varying(42),
    usdt_amount numeric(20,6) DEFAULT 0,
    pp_amount numeric(20,6) DEFAULT 0,
    fee numeric(20,6) DEFAULT 0,
    meta jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT transactions_type_check CHECK (((type)::text = ANY ((ARRAY['deposit'::character varying, 'claim'::character varying, 'hijack'::character varying, 'battle_failed'::character varying, 'swap'::character varying, 'withdraw'::character varying, 'withdraw_all'::character varying, 'mining'::character varying, 'rank_reward'::character varying, 'referral'::character varying, 'quest'::character varying, 'shop_purchase'::character varying, 'crash_bet'::character varying, 'crash_win'::character varying, 'mines_bet'::character varying, 'mines_win'::character varying, 'coinflip_bet'::character varying, 'coinflip_win'::character varying, 'dice_bet'::character varying, 'dice_win'::character varying, 'hilo_bet'::character varying, 'hilo_win'::character varying, 'maintenance_fee'::character varying, 'instant_harvest'::character varying, 'rename_fee'::character varying, 'poi_hint'::character varying, 'loot_priority'::character varying, 'auto_renew'::character varying, 'pp_to_gp_exchange'::character varying, 'war_game_continue'::character varying, 'enhance_attempt'::character varying, 'marketplace_sale'::character varying, 'marketplace_fee'::character varying, 'marketplace_listing_fee'::character varying, 'marketplace_bid_hold'::character varying, 'marketplace_bid_refund'::character varying, 'resource_sale'::character varying])::text[])))
);


ALTER TABLE public.transactions OWNER TO jongho;

--
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.transactions_id_seq OWNER TO jongho;

--
-- Name: transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.transactions_id_seq OWNED BY public.transactions.id;


--
-- Name: user_active_effects; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.user_active_effects (
    id integer NOT NULL,
    wallet character varying(42) NOT NULL,
    effect_type character varying(30) NOT NULL,
    effect_value numeric(8,2) DEFAULT 0 NOT NULL,
    uses_remaining integer,
    activated_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    active boolean DEFAULT true,
    auto_renew boolean DEFAULT false,
    source_item_code character varying(20) DEFAULT NULL::character varying
);


ALTER TABLE public.user_active_effects OWNER TO jongho;

--
-- Name: user_active_effects_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.user_active_effects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_active_effects_id_seq OWNER TO jongho;

--
-- Name: user_active_effects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.user_active_effects_id_seq OWNED BY public.user_active_effects.id;


--
-- Name: user_breakthroughs; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.user_breakthroughs (
    id integer NOT NULL,
    wallet_address character varying(255) NOT NULL,
    level integer NOT NULL,
    unlocked_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.user_breakthroughs OWNER TO jongho;

--
-- Name: user_breakthroughs_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.user_breakthroughs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_breakthroughs_id_seq OWNER TO jongho;

--
-- Name: user_breakthroughs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.user_breakthroughs_id_seq OWNED BY public.user_breakthroughs.id;


--
-- Name: user_cosmetics; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.user_cosmetics (
    id integer NOT NULL,
    wallet character varying(42) NOT NULL,
    claim_id integer NOT NULL,
    cosmetic_type character varying(20) NOT NULL,
    cosmetic_code character varying(30) NOT NULL,
    equipped_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_cosmetics_cosmetic_type_check CHECK (((cosmetic_type)::text = ANY ((ARRAY['border'::character varying, 'glow'::character varying, 'terrain'::character varying])::text[])))
);


ALTER TABLE public.user_cosmetics OWNER TO jongho;

--
-- Name: user_cosmetics_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.user_cosmetics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_cosmetics_id_seq OWNER TO jongho;

--
-- Name: user_cosmetics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.user_cosmetics_id_seq OWNED BY public.user_cosmetics.id;


--
-- Name: user_items; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.user_items (
    id integer NOT NULL,
    wallet character varying(42) NOT NULL,
    item_type_id integer,
    quantity integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.user_items OWNER TO jongho;

--
-- Name: user_items_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.user_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_items_id_seq OWNER TO jongho;

--
-- Name: user_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.user_items_id_seq OWNED BY public.user_items.id;


--
-- Name: user_mining; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.user_mining (
    wallet_address character varying(42) NOT NULL,
    last_harvest_at timestamp with time zone,
    total_mined_pp numeric(20,6) DEFAULT 0,
    today_mined_pp numeric(20,6) DEFAULT 0,
    today_date date DEFAULT CURRENT_DATE
);


ALTER TABLE public.user_mining OWNER TO jongho;

--
-- Name: user_onboarding; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.user_onboarding (
    id integer NOT NULL,
    wallet_address character varying(42) NOT NULL,
    current_step integer DEFAULT 0,
    completed boolean DEFAULT false,
    skipped boolean DEFAULT false,
    reward_claimed boolean DEFAULT false,
    tutorial_claim_id integer,
    step_completed_at jsonb DEFAULT '{}'::jsonb,
    skipped_at timestamp without time zone,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.user_onboarding OWNER TO jongho;

--
-- Name: user_onboarding_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.user_onboarding_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_onboarding_id_seq OWNER TO jongho;

--
-- Name: user_onboarding_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.user_onboarding_id_seq OWNED BY public.user_onboarding.id;


--
-- Name: user_quests; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.user_quests (
    id integer NOT NULL,
    wallet character varying(255) NOT NULL,
    template_id integer,
    tier character varying(10) NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    requirement_type character varying(30) NOT NULL,
    requirement_value numeric NOT NULL,
    current_progress numeric DEFAULT 0 NOT NULL,
    reward_pp numeric(12,4) NOT NULL,
    status character varying(15) DEFAULT 'active'::character varying NOT NULL,
    assigned_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL,
    claimed_at timestamp with time zone,
    CONSTRAINT user_quests_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'completed'::character varying, 'claimed'::character varying, 'expired'::character varying])::text[])))
);


ALTER TABLE public.user_quests OWNER TO jongho;

--
-- Name: user_quests_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.user_quests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_quests_id_seq OWNER TO jongho;

--
-- Name: user_quests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.user_quests_id_seq OWNED BY public.user_quests.id;


--
-- Name: user_resource_inventory; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.user_resource_inventory (
    id integer NOT NULL,
    wallet_address character varying(42) NOT NULL,
    resource_id integer NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT user_resource_inventory_quantity_check CHECK ((quantity >= 0))
);


ALTER TABLE public.user_resource_inventory OWNER TO jongho;

--
-- Name: user_resource_inventory_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.user_resource_inventory_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_resource_inventory_id_seq OWNER TO jongho;

--
-- Name: user_resource_inventory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.user_resource_inventory_id_seq OWNED BY public.user_resource_inventory.id;


--
-- Name: user_sector_activity; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.user_sector_activity (
    wallet_address character varying(42) NOT NULL,
    sector_id integer NOT NULL,
    action_count integer DEFAULT 0,
    last_action_at timestamp with time zone DEFAULT now(),
    week_start date DEFAULT (date_trunc('week'::text, (CURRENT_DATE)::timestamp with time zone))::date NOT NULL
);


ALTER TABLE public.user_sector_activity OWNER TO jongho;

--
-- Name: user_titles; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.user_titles (
    id integer NOT NULL,
    user_wallet character varying(42) NOT NULL,
    title_code character varying(50) NOT NULL,
    title_en character varying(100),
    title_ko character varying(100),
    title_ja character varying(100),
    title_zh character varying(100),
    earned_at timestamp without time zone DEFAULT now(),
    is_equipped boolean DEFAULT false,
    season_id integer
);


ALTER TABLE public.user_titles OWNER TO jongho;

--
-- Name: user_titles_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.user_titles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_titles_id_seq OWNER TO jongho;

--
-- Name: user_titles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.user_titles_id_seq OWNED BY public.user_titles.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.users (
    wallet_address character varying(42) NOT NULL,
    email character varying(255),
    password_hash character varying(255),
    nickname character varying(50),
    usdt_balance numeric(20,6) DEFAULT 0,
    pp_balance numeric(20,6) DEFAULT 0,
    referred_by character varying(42),
    referral_code character varying(20),
    created_at timestamp with time zone DEFAULT now(),
    withdrawal_nonce integer DEFAULT 0,
    xp integer DEFAULT 0,
    rank_level integer DEFAULT 1,
    last_login_at timestamp with time zone,
    total_actions integer DEFAULT 0,
    hijack_count integer DEFAULT 0,
    last_withdrawal_at timestamp with time zone,
    tos_accepted_at timestamp with time zone,
    tos_version character varying(10) DEFAULT '1.0'::character varying,
    gp_balance numeric(20,6) DEFAULT 0,
    guild_id integer,
    current_job_id integer,
    job_selected_at timestamp without time zone,
    job_changed_at timestamp without time zone,
    weekly_job_change_count integer DEFAULT 0,
    weekly_job_reset_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.users OWNER TO jongho;

--
-- Name: war_bet_events; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.war_bet_events (
    id integer NOT NULL,
    event_type character varying(30) NOT NULL,
    event_id integer NOT NULL,
    option_a_label character varying(100),
    option_b_label character varying(100),
    total_bet_a bigint DEFAULT 0,
    total_bet_b bigint DEFAULT 0,
    status character varying(20) DEFAULT 'open'::character varying,
    winner_option character varying(5),
    opens_at timestamp without time zone DEFAULT now(),
    closes_at timestamp without time zone,
    resolved_at timestamp without time zone,
    CONSTRAINT war_bet_events_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'closed'::character varying, 'resolved'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.war_bet_events OWNER TO jongho;

--
-- Name: war_bet_events_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.war_bet_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.war_bet_events_id_seq OWNER TO jongho;

--
-- Name: war_bet_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.war_bet_events_id_seq OWNED BY public.war_bet_events.id;


--
-- Name: war_bets; Type: TABLE; Schema: public; Owner: jongho
--

CREATE TABLE public.war_bets (
    id integer NOT NULL,
    event_id integer NOT NULL,
    user_wallet character varying(42) NOT NULL,
    option character varying(5) NOT NULL,
    amount_gp integer NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    payout_gp integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT war_bets_amount_gp_check CHECK ((amount_gp > 0)),
    CONSTRAINT war_bets_option_check CHECK (((option)::text = ANY ((ARRAY['a'::character varying, 'b'::character varying])::text[]))),
    CONSTRAINT war_bets_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'won'::character varying, 'lost'::character varying, 'refunded'::character varying])::text[])))
);


ALTER TABLE public.war_bets OWNER TO jongho;

--
-- Name: war_bets_id_seq; Type: SEQUENCE; Schema: public; Owner: jongho
--

CREATE SEQUENCE public.war_bets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.war_bets_id_seq OWNER TO jongho;

--
-- Name: war_bets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jongho
--

ALTER SEQUENCE public.war_bets_id_seq OWNED BY public.war_bets.id;


--
-- Name: admin_audit_log id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.admin_audit_log ALTER COLUMN id SET DEFAULT nextval('public.admin_audit_log_id_seq'::regclass);


--
-- Name: battles id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.battles ALTER COLUMN id SET DEFAULT nextval('public.battles_id_seq'::regclass);


--
-- Name: bounties id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.bounties ALTER COLUMN id SET DEFAULT nextval('public.bounties_id_seq'::regclass);


--
-- Name: citizen_rewards id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.citizen_rewards ALTER COLUMN id SET DEFAULT nextval('public.citizen_rewards_id_seq'::regclass);


--
-- Name: claims id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.claims ALTER COLUMN id SET DEFAULT nextval('public.claims_id_seq'::regclass);


--
-- Name: client_errors id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.client_errors ALTER COLUMN id SET DEFAULT nextval('public.client_errors_id_seq'::regclass);


--
-- Name: coinflip_games id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.coinflip_games ALTER COLUMN id SET DEFAULT nextval('public.coinflip_games_id_seq'::regclass);


--
-- Name: commander id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.commander ALTER COLUMN id SET DEFAULT nextval('public.commander_id_seq'::regclass);


--
-- Name: crash_bets id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.crash_bets ALTER COLUMN id SET DEFAULT nextval('public.crash_bets_id_seq'::regclass);


--
-- Name: crash_rounds id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.crash_rounds ALTER COLUMN id SET DEFAULT nextval('public.crash_rounds_id_seq'::regclass);


--
-- Name: daily_logins id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.daily_logins ALTER COLUMN id SET DEFAULT nextval('public.daily_logins_id_seq'::regclass);


--
-- Name: daily_missions id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.daily_missions ALTER COLUMN id SET DEFAULT nextval('public.daily_missions_id_seq'::regclass);


--
-- Name: deposits id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.deposits ALTER COLUMN id SET DEFAULT nextval('public.deposits_id_seq'::regclass);


--
-- Name: dice_games id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.dice_games ALTER COLUMN id SET DEFAULT nextval('public.dice_games_id_seq'::regclass);


--
-- Name: enhancement_log id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.enhancement_log ALTER COLUMN id SET DEFAULT nextval('public.enhancement_log_id_seq'::regclass);


--
-- Name: events id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.events ALTER COLUMN id SET DEFAULT nextval('public.events_id_seq'::regclass);


--
-- Name: exploration_pois id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.exploration_pois ALTER COLUMN id SET DEFAULT nextval('public.exploration_pois_id_seq'::regclass);


--
-- Name: game_items id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.game_items ALTER COLUMN id SET DEFAULT nextval('public.game_items_id_seq'::regclass);


--
-- Name: global_events_gov id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.global_events_gov ALTER COLUMN id SET DEFAULT nextval('public.global_events_gov_id_seq'::regclass);


--
-- Name: governance_history id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.governance_history ALTER COLUMN id SET DEFAULT nextval('public.governance_history_id_seq'::regclass);


--
-- Name: governance_positions id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.governance_positions ALTER COLUMN id SET DEFAULT nextval('public.governance_positions_id_seq'::regclass);


--
-- Name: governance_transactions id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.governance_transactions ALTER COLUMN id SET DEFAULT nextval('public.governance_transactions_id_seq'::regclass);


--
-- Name: governor_fees id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.governor_fees ALTER COLUMN id SET DEFAULT nextval('public.governor_fees_id_seq'::regclass);


--
-- Name: governor_hall_of_fame id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.governor_hall_of_fame ALTER COLUMN id SET DEFAULT nextval('public.governor_hall_of_fame_id_seq'::regclass);


--
-- Name: governor_sieges id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.governor_sieges ALTER COLUMN id SET DEFAULT nextval('public.governor_sieges_id_seq'::regclass);


--
-- Name: guild_invites id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.guild_invites ALTER COLUMN id SET DEFAULT nextval('public.guild_invites_id_seq'::regclass);


--
-- Name: guild_messages id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.guild_messages ALTER COLUMN id SET DEFAULT nextval('public.guild_messages_id_seq'::regclass);


--
-- Name: guild_raids id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.guild_raids ALTER COLUMN id SET DEFAULT nextval('public.guild_raids_id_seq'::regclass);


--
-- Name: guild_treasury_ledger id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.guild_treasury_ledger ALTER COLUMN id SET DEFAULT nextval('public.guild_treasury_ledger_id_seq'::regclass);


--
-- Name: guild_war_actions id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.guild_war_actions ALTER COLUMN id SET DEFAULT nextval('public.guild_war_actions_id_seq'::regclass);


--
-- Name: guild_wars id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.guild_wars ALTER COLUMN id SET DEFAULT nextval('public.guild_wars_id_seq'::regclass);


--
-- Name: guilds id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.guilds ALTER COLUMN id SET DEFAULT nextval('public.guilds_id_seq'::regclass);


--
-- Name: hall_of_fame id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.hall_of_fame ALTER COLUMN id SET DEFAULT nextval('public.hall_of_fame_id_seq'::regclass);


--
-- Name: hilo_games id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.hilo_games ALTER COLUMN id SET DEFAULT nextval('public.hilo_games_id_seq'::regclass);


--
-- Name: item_instances id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.item_instances ALTER COLUMN id SET DEFAULT nextval('public.item_instances_id_seq'::regclass);


--
-- Name: item_types id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.item_types ALTER COLUMN id SET DEFAULT nextval('public.item_types_id_seq'::regclass);


--
-- Name: item_usage_log id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.item_usage_log ALTER COLUMN id SET DEFAULT nextval('public.item_usage_log_id_seq'::regclass);


--
-- Name: job_buffs id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.job_buffs ALTER COLUMN id SET DEFAULT nextval('public.job_buffs_id_seq'::regclass);


--
-- Name: job_change_log id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.job_change_log ALTER COLUMN id SET DEFAULT nextval('public.job_change_log_id_seq'::regclass);


--
-- Name: jobs id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.jobs ALTER COLUMN id SET DEFAULT nextval('public.jobs_id_seq'::regclass);


--
-- Name: loading_lore id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.loading_lore ALTER COLUMN id SET DEFAULT nextval('public.loading_lore_id_seq'::regclass);


--
-- Name: loot_priority_claims id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.loot_priority_claims ALTER COLUMN id SET DEFAULT nextval('public.loot_priority_claims_id_seq'::regclass);


--
-- Name: lore_crawl id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.lore_crawl ALTER COLUMN id SET DEFAULT nextval('public.lore_crawl_id_seq'::regclass);


--
-- Name: maintenance_log id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.maintenance_log ALTER COLUMN id SET DEFAULT nextval('public.maintenance_log_id_seq'::regclass);


--
-- Name: marketplace_listings id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.marketplace_listings ALTER COLUMN id SET DEFAULT nextval('public.marketplace_listings_id_seq'::regclass);


--
-- Name: marketplace_price_history id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.marketplace_price_history ALTER COLUMN id SET DEFAULT nextval('public.marketplace_price_history_id_seq'::regclass);


--
-- Name: mars_weather id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.mars_weather ALTER COLUMN id SET DEFAULT nextval('public.mars_weather_id_seq'::regclass);


--
-- Name: mines_games id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.mines_games ALTER COLUMN id SET DEFAULT nextval('public.mines_games_id_seq'::regclass);


--
-- Name: missions id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.missions ALTER COLUMN id SET DEFAULT nextval('public.missions_id_seq'::regclass);


--
-- Name: password_reset_tokens id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.password_reset_tokens ALTER COLUMN id SET DEFAULT nextval('public.password_reset_tokens_id_seq'::regclass);


--
-- Name: pixel_shields id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.pixel_shields ALTER COLUMN id SET DEFAULT nextval('public.pixel_shields_id_seq'::regclass);


--
-- Name: poi_discoveries id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.poi_discoveries ALTER COLUMN id SET DEFAULT nextval('public.poi_discoveries_id_seq'::regclass);


--
-- Name: poi_drop_table id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.poi_drop_table ALTER COLUMN id SET DEFAULT nextval('public.poi_drop_table_id_seq'::regclass);


--
-- Name: quest_definitions id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.quest_definitions ALTER COLUMN id SET DEFAULT nextval('public.quest_definitions_id_seq'::regclass);


--
-- Name: quest_templates id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.quest_templates ALTER COLUMN id SET DEFAULT nextval('public.quest_templates_id_seq'::regclass);


--
-- Name: referral_rewards id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.referral_rewards ALTER COLUMN id SET DEFAULT nextval('public.referral_rewards_id_seq'::regclass);


--
-- Name: resources id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.resources ALTER COLUMN id SET DEFAULT nextval('public.resources_id_seq'::regclass);


--
-- Name: rocket_events id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.rocket_events ALTER COLUMN id SET DEFAULT nextval('public.rocket_events_id_seq'::regclass);


--
-- Name: rocket_loot_claims id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.rocket_loot_claims ALTER COLUMN id SET DEFAULT nextval('public.rocket_loot_claims_id_seq'::regclass);


--
-- Name: schema_migrations id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.schema_migrations ALTER COLUMN id SET DEFAULT nextval('public.schema_migrations_id_seq'::regclass);


--
-- Name: season_pass_claims id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.season_pass_claims ALTER COLUMN id SET DEFAULT nextval('public.season_pass_claims_id_seq'::regclass);


--
-- Name: season_pass_tiers id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.season_pass_tiers ALTER COLUMN id SET DEFAULT nextval('public.season_pass_tiers_id_seq'::regclass);


--
-- Name: season_rewards id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.season_rewards ALTER COLUMN id SET DEFAULT nextval('public.season_rewards_id_seq'::regclass);


--
-- Name: season_scores id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.season_scores ALTER COLUMN id SET DEFAULT nextval('public.season_scores_id_seq'::regclass);


--
-- Name: seasons id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.seasons ALTER COLUMN id SET DEFAULT nextval('public.seasons_id_seq'::regclass);


--
-- Name: sector_buffs id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.sector_buffs ALTER COLUMN id SET DEFAULT nextval('public.sector_buffs_id_seq'::regclass);


--
-- Name: sector_definitions id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.sector_definitions ALTER COLUMN id SET DEFAULT nextval('public.sector_definitions_id_seq'::regclass);


--
-- Name: sector_entry_requirements id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.sector_entry_requirements ALTER COLUMN id SET DEFAULT nextval('public.sector_entry_requirements_id_seq'::regclass);


--
-- Name: sector_governance id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.sector_governance ALTER COLUMN id SET DEFAULT nextval('public.sector_governance_id_seq'::regclass);


--
-- Name: sector_resource_rates id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.sector_resource_rates ALTER COLUMN id SET DEFAULT nextval('public.sector_resource_rates_id_seq'::regclass);


--
-- Name: sectors id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.sectors ALTER COLUMN id SET DEFAULT nextval('public.sectors_id_seq'::regclass);


--
-- Name: server_chronicles id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.server_chronicles ALTER COLUMN id SET DEFAULT nextval('public.server_chronicles_id_seq'::regclass);


--
-- Name: starlink_passes id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.starlink_passes ALTER COLUMN id SET DEFAULT nextval('public.starlink_passes_id_seq'::regclass);


--
-- Name: transactions id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.transactions ALTER COLUMN id SET DEFAULT nextval('public.transactions_id_seq'::regclass);


--
-- Name: user_active_effects id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.user_active_effects ALTER COLUMN id SET DEFAULT nextval('public.user_active_effects_id_seq'::regclass);


--
-- Name: user_breakthroughs id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.user_breakthroughs ALTER COLUMN id SET DEFAULT nextval('public.user_breakthroughs_id_seq'::regclass);


--
-- Name: user_cosmetics id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.user_cosmetics ALTER COLUMN id SET DEFAULT nextval('public.user_cosmetics_id_seq'::regclass);


--
-- Name: user_items id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.user_items ALTER COLUMN id SET DEFAULT nextval('public.user_items_id_seq'::regclass);


--
-- Name: user_onboarding id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.user_onboarding ALTER COLUMN id SET DEFAULT nextval('public.user_onboarding_id_seq'::regclass);


--
-- Name: user_quests id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.user_quests ALTER COLUMN id SET DEFAULT nextval('public.user_quests_id_seq'::regclass);


--
-- Name: user_resource_inventory id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.user_resource_inventory ALTER COLUMN id SET DEFAULT nextval('public.user_resource_inventory_id_seq'::regclass);


--
-- Name: user_titles id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.user_titles ALTER COLUMN id SET DEFAULT nextval('public.user_titles_id_seq'::regclass);


--
-- Name: war_bet_events id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.war_bet_events ALTER COLUMN id SET DEFAULT nextval('public.war_bet_events_id_seq'::regclass);


--
-- Name: war_bets id; Type: DEFAULT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.war_bets ALTER COLUMN id SET DEFAULT nextval('public.war_bets_id_seq'::regclass);


--
-- Name: admin_audit_log admin_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.admin_audit_log
    ADD CONSTRAINT admin_audit_log_pkey PRIMARY KEY (id);


--
-- Name: battles battles_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.battles
    ADD CONSTRAINT battles_pkey PRIMARY KEY (id);


--
-- Name: bounties bounties_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.bounties
    ADD CONSTRAINT bounties_pkey PRIMARY KEY (id);


--
-- Name: citizen_rewards citizen_rewards_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.citizen_rewards
    ADD CONSTRAINT citizen_rewards_pkey PRIMARY KEY (id);


--
-- Name: claims claims_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.claims
    ADD CONSTRAINT claims_pkey PRIMARY KEY (id);


--
-- Name: client_errors client_errors_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.client_errors
    ADD CONSTRAINT client_errors_pkey PRIMARY KEY (id);


--
-- Name: coinflip_games coinflip_games_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.coinflip_games
    ADD CONSTRAINT coinflip_games_pkey PRIMARY KEY (id);


--
-- Name: commander commander_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.commander
    ADD CONSTRAINT commander_pkey PRIMARY KEY (id);


--
-- Name: crash_bets crash_bets_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.crash_bets
    ADD CONSTRAINT crash_bets_pkey PRIMARY KEY (id);


--
-- Name: crash_rounds crash_rounds_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.crash_rounds
    ADD CONSTRAINT crash_rounds_pkey PRIMARY KEY (id);


--
-- Name: daily_logins daily_logins_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.daily_logins
    ADD CONSTRAINT daily_logins_pkey PRIMARY KEY (id);


--
-- Name: daily_logins daily_logins_wallet_login_date_key; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.daily_logins
    ADD CONSTRAINT daily_logins_wallet_login_date_key UNIQUE (wallet, login_date);


--
-- Name: daily_missions daily_missions_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.daily_missions
    ADD CONSTRAINT daily_missions_pkey PRIMARY KEY (id);


--
-- Name: daily_missions daily_missions_wallet_mission_date_slot_key; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.daily_missions
    ADD CONSTRAINT daily_missions_wallet_mission_date_slot_key UNIQUE (wallet, mission_date, slot);


--
-- Name: deposits deposits_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.deposits
    ADD CONSTRAINT deposits_pkey PRIMARY KEY (id);


--
-- Name: deposits deposits_tx_hash_key; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.deposits
    ADD CONSTRAINT deposits_tx_hash_key UNIQUE (tx_hash);


--
-- Name: dice_games dice_games_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.dice_games
    ADD CONSTRAINT dice_games_pkey PRIMARY KEY (id);


--
-- Name: enhancement_log enhancement_log_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.enhancement_log
    ADD CONSTRAINT enhancement_log_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: exploration_pois exploration_pois_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.exploration_pois
    ADD CONSTRAINT exploration_pois_pkey PRIMARY KEY (id);


--
-- Name: game_items game_items_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.game_items
    ADD CONSTRAINT game_items_pkey PRIMARY KEY (id);


--
-- Name: game_items game_items_slug_key; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.game_items
    ADD CONSTRAINT game_items_slug_key UNIQUE (slug);


--
-- Name: global_events_gov global_events_gov_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.global_events_gov
    ADD CONSTRAINT global_events_gov_pkey PRIMARY KEY (id);


--
-- Name: governance_history governance_history_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.governance_history
    ADD CONSTRAINT governance_history_pkey PRIMARY KEY (id);


--
-- Name: governance_positions governance_positions_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.governance_positions
    ADD CONSTRAINT governance_positions_pkey PRIMARY KEY (id);


--
-- Name: governance_positions governance_positions_role_sector_id_key; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.governance_positions
    ADD CONSTRAINT governance_positions_role_sector_id_key UNIQUE (role, sector_id);


--
-- Name: governance_transactions governance_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.governance_transactions
    ADD CONSTRAINT governance_transactions_pkey PRIMARY KEY (id);


--
-- Name: governor_fees governor_fees_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.governor_fees
    ADD CONSTRAINT governor_fees_pkey PRIMARY KEY (id);


--
-- Name: governor_hall_of_fame governor_hall_of_fame_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.governor_hall_of_fame
    ADD CONSTRAINT governor_hall_of_fame_pkey PRIMARY KEY (id);


--
-- Name: governor_sieges governor_sieges_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.governor_sieges
    ADD CONSTRAINT governor_sieges_pkey PRIMARY KEY (id);


--
-- Name: guild_invites guild_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.guild_invites
    ADD CONSTRAINT guild_invites_pkey PRIMARY KEY (id);


--
-- Name: guild_members guild_members_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.guild_members
    ADD CONSTRAINT guild_members_pkey PRIMARY KEY (guild_id, wallet);


--
-- Name: guild_members guild_members_wallet_key; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.guild_members
    ADD CONSTRAINT guild_members_wallet_key UNIQUE (wallet);


--
-- Name: guild_messages guild_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.guild_messages
    ADD CONSTRAINT guild_messages_pkey PRIMARY KEY (id);


--
-- Name: guild_raids guild_raids_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.guild_raids
    ADD CONSTRAINT guild_raids_pkey PRIMARY KEY (id);


--
-- Name: guild_treasury_ledger guild_treasury_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.guild_treasury_ledger
    ADD CONSTRAINT guild_treasury_ledger_pkey PRIMARY KEY (id);


--
-- Name: guild_war_actions guild_war_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.guild_war_actions
    ADD CONSTRAINT guild_war_actions_pkey PRIMARY KEY (id);


--
-- Name: guild_wars guild_wars_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.guild_wars
    ADD CONSTRAINT guild_wars_pkey PRIMARY KEY (id);


--
-- Name: guilds guilds_name_key; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.guilds
    ADD CONSTRAINT guilds_name_key UNIQUE (name);


--
-- Name: guilds guilds_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.guilds
    ADD CONSTRAINT guilds_pkey PRIMARY KEY (id);


--
-- Name: guilds guilds_tag_key; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.guilds
    ADD CONSTRAINT guilds_tag_key UNIQUE (tag);


--
-- Name: hall_of_fame hall_of_fame_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.hall_of_fame
    ADD CONSTRAINT hall_of_fame_pkey PRIMARY KEY (id);


--
-- Name: hilo_games hilo_games_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.hilo_games
    ADD CONSTRAINT hilo_games_pkey PRIMARY KEY (id);


--
-- Name: item_instances item_instances_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.item_instances
    ADD CONSTRAINT item_instances_pkey PRIMARY KEY (id);


--
-- Name: item_types item_types_code_key; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.item_types
    ADD CONSTRAINT item_types_code_key UNIQUE (code);


--
-- Name: item_types item_types_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.item_types
    ADD CONSTRAINT item_types_pkey PRIMARY KEY (id);


--
-- Name: item_usage_log item_usage_log_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.item_usage_log
    ADD CONSTRAINT item_usage_log_pkey PRIMARY KEY (id);


--
-- Name: job_buffs job_buffs_job_id_buff_key_key; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.job_buffs
    ADD CONSTRAINT job_buffs_job_id_buff_key_key UNIQUE (job_id, buff_key);


--
-- Name: job_buffs job_buffs_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.job_buffs
    ADD CONSTRAINT job_buffs_pkey PRIMARY KEY (id);


--
-- Name: job_change_log job_change_log_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.job_change_log
    ADD CONSTRAINT job_change_log_pkey PRIMARY KEY (id);


--
-- Name: jobs jobs_code_key; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_code_key UNIQUE (code);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: loading_lore loading_lore_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.loading_lore
    ADD CONSTRAINT loading_lore_pkey PRIMARY KEY (id);


--
-- Name: loot_priority_claims loot_priority_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.loot_priority_claims
    ADD CONSTRAINT loot_priority_claims_pkey PRIMARY KEY (id);


--
-- Name: loot_priority_claims loot_priority_claims_wallet_rocket_event_id_key; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.loot_priority_claims
    ADD CONSTRAINT loot_priority_claims_wallet_rocket_event_id_key UNIQUE (wallet, rocket_event_id);


--
-- Name: lore_crawl lore_crawl_lang_key; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.lore_crawl
    ADD CONSTRAINT lore_crawl_lang_key UNIQUE (lang);


--
-- Name: lore_crawl lore_crawl_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.lore_crawl
    ADD CONSTRAINT lore_crawl_pkey PRIMARY KEY (id);


--
-- Name: maintenance_log maintenance_log_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.maintenance_log
    ADD CONSTRAINT maintenance_log_pkey PRIMARY KEY (id);


--
-- Name: marketplace_listings marketplace_listings_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.marketplace_listings
    ADD CONSTRAINT marketplace_listings_pkey PRIMARY KEY (id);


--
-- Name: marketplace_price_history marketplace_price_history_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.marketplace_price_history
    ADD CONSTRAINT marketplace_price_history_pkey PRIMARY KEY (id);


--
-- Name: mars_weather mars_weather_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.mars_weather
    ADD CONSTRAINT mars_weather_pkey PRIMARY KEY (id);


--
-- Name: mines_games mines_games_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.mines_games
    ADD CONSTRAINT mines_games_pkey PRIMARY KEY (id);


--
-- Name: missions missions_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_key UNIQUE (token);


--
-- Name: pixel_shields pixel_shields_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.pixel_shields
    ADD CONSTRAINT pixel_shields_pkey PRIMARY KEY (id);


--
-- Name: pixels pixels_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.pixels
    ADD CONSTRAINT pixels_pkey PRIMARY KEY (lat, lng);


--
-- Name: poi_discoveries poi_discoveries_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.poi_discoveries
    ADD CONSTRAINT poi_discoveries_pkey PRIMARY KEY (id);


--
-- Name: poi_drop_table poi_drop_table_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.poi_drop_table
    ADD CONSTRAINT poi_drop_table_pkey PRIMARY KEY (id);


--
-- Name: quest_definitions quest_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.quest_definitions
    ADD CONSTRAINT quest_definitions_pkey PRIMARY KEY (id);


--
-- Name: quest_reward_pool quest_reward_pool_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.quest_reward_pool
    ADD CONSTRAINT quest_reward_pool_pkey PRIMARY KEY (id);


--
-- Name: quest_templates quest_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.quest_templates
    ADD CONSTRAINT quest_templates_pkey PRIMARY KEY (id);


--
-- Name: rank_definitions rank_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.rank_definitions
    ADD CONSTRAINT rank_definitions_pkey PRIMARY KEY (level);


--
-- Name: referral_rewards referral_rewards_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.referral_rewards
    ADD CONSTRAINT referral_rewards_pkey PRIMARY KEY (id);


--
-- Name: resources resources_code_key; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.resources
    ADD CONSTRAINT resources_code_key UNIQUE (code);


--
-- Name: resources resources_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.resources
    ADD CONSTRAINT resources_pkey PRIMARY KEY (id);


--
-- Name: rocket_events rocket_events_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.rocket_events
    ADD CONSTRAINT rocket_events_pkey PRIMARY KEY (id);


--
-- Name: rocket_loot_claims rocket_loot_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.rocket_loot_claims
    ADD CONSTRAINT rocket_loot_claims_pkey PRIMARY KEY (id);


--
-- Name: rocket_loot_claims rocket_loot_claims_rocket_event_id_loot_index_key; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.rocket_loot_claims
    ADD CONSTRAINT rocket_loot_claims_rocket_event_id_loot_index_key UNIQUE (rocket_event_id, loot_index);


--
-- Name: schema_migrations schema_migrations_filename_key; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_filename_key UNIQUE (filename);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (id);


--
-- Name: season_pass_claims season_pass_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.season_pass_claims
    ADD CONSTRAINT season_pass_claims_pkey PRIMARY KEY (id);


--
-- Name: season_pass_claims season_pass_claims_season_id_wallet_tier_is_premium_key; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.season_pass_claims
    ADD CONSTRAINT season_pass_claims_season_id_wallet_tier_is_premium_key UNIQUE (season_id, wallet, tier, is_premium);


--
-- Name: season_pass_progress season_pass_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.season_pass_progress
    ADD CONSTRAINT season_pass_progress_pkey PRIMARY KEY (season_id, wallet);


--
-- Name: season_pass_tiers season_pass_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.season_pass_tiers
    ADD CONSTRAINT season_pass_tiers_pkey PRIMARY KEY (id);


--
-- Name: season_pass_tiers season_pass_tiers_season_id_tier_is_premium_key; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.season_pass_tiers
    ADD CONSTRAINT season_pass_tiers_season_id_tier_is_premium_key UNIQUE (season_id, tier, is_premium);


--
-- Name: season_rewards season_rewards_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.season_rewards
    ADD CONSTRAINT season_rewards_pkey PRIMARY KEY (id);


--
-- Name: season_scores season_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.season_scores
    ADD CONSTRAINT season_scores_pkey PRIMARY KEY (id);


--
-- Name: season_scores season_scores_season_id_wallet_key; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.season_scores
    ADD CONSTRAINT season_scores_season_id_wallet_key UNIQUE (season_id, wallet);


--
-- Name: seasons seasons_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.seasons
    ADD CONSTRAINT seasons_pkey PRIMARY KEY (id);


--
-- Name: sector_buffs sector_buffs_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.sector_buffs
    ADD CONSTRAINT sector_buffs_pkey PRIMARY KEY (id);


--
-- Name: sector_definitions sector_definitions_code_key; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.sector_definitions
    ADD CONSTRAINT sector_definitions_code_key UNIQUE (code);


--
-- Name: sector_definitions sector_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.sector_definitions
    ADD CONSTRAINT sector_definitions_pkey PRIMARY KEY (id);


--
-- Name: sector_entry_requirements sector_entry_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.sector_entry_requirements
    ADD CONSTRAINT sector_entry_requirements_pkey PRIMARY KEY (id);


--
-- Name: sector_entry_requirements sector_entry_requirements_sector_code_key; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.sector_entry_requirements
    ADD CONSTRAINT sector_entry_requirements_sector_code_key UNIQUE (sector_code);


--
-- Name: sector_governance sector_governance_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.sector_governance
    ADD CONSTRAINT sector_governance_pkey PRIMARY KEY (id);


--
-- Name: sector_governance sector_governance_sector_code_key; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.sector_governance
    ADD CONSTRAINT sector_governance_sector_code_key UNIQUE (sector_code);


--
-- Name: sector_resource_rates sector_resource_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.sector_resource_rates
    ADD CONSTRAINT sector_resource_rates_pkey PRIMARY KEY (id);


--
-- Name: sector_resource_rates sector_resource_rates_sector_type_resource_code_key; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.sector_resource_rates
    ADD CONSTRAINT sector_resource_rates_sector_type_resource_code_key UNIQUE (sector_type, resource_code);


--
-- Name: sectors sectors_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.sectors
    ADD CONSTRAINT sectors_pkey PRIMARY KEY (id);


--
-- Name: server_chronicles server_chronicles_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.server_chronicles
    ADD CONSTRAINT server_chronicles_pkey PRIMARY KEY (id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (key);


--
-- Name: starlink_passes starlink_passes_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.starlink_passes
    ADD CONSTRAINT starlink_passes_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: user_active_effects user_active_effects_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.user_active_effects
    ADD CONSTRAINT user_active_effects_pkey PRIMARY KEY (id);


--
-- Name: user_breakthroughs user_breakthroughs_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.user_breakthroughs
    ADD CONSTRAINT user_breakthroughs_pkey PRIMARY KEY (id);


--
-- Name: user_breakthroughs user_breakthroughs_wallet_address_level_key; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.user_breakthroughs
    ADD CONSTRAINT user_breakthroughs_wallet_address_level_key UNIQUE (wallet_address, level);


--
-- Name: user_cosmetics user_cosmetics_claim_id_cosmetic_type_key; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.user_cosmetics
    ADD CONSTRAINT user_cosmetics_claim_id_cosmetic_type_key UNIQUE (claim_id, cosmetic_type);


--
-- Name: user_cosmetics user_cosmetics_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.user_cosmetics
    ADD CONSTRAINT user_cosmetics_pkey PRIMARY KEY (id);


--
-- Name: user_items user_items_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.user_items
    ADD CONSTRAINT user_items_pkey PRIMARY KEY (id);


--
-- Name: user_items user_items_wallet_item_type_id_key; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.user_items
    ADD CONSTRAINT user_items_wallet_item_type_id_key UNIQUE (wallet, item_type_id);


--
-- Name: user_mining user_mining_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.user_mining
    ADD CONSTRAINT user_mining_pkey PRIMARY KEY (wallet_address);


--
-- Name: user_onboarding user_onboarding_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.user_onboarding
    ADD CONSTRAINT user_onboarding_pkey PRIMARY KEY (id);


--
-- Name: user_onboarding user_onboarding_wallet_address_key; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.user_onboarding
    ADD CONSTRAINT user_onboarding_wallet_address_key UNIQUE (wallet_address);


--
-- Name: user_quests user_quests_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.user_quests
    ADD CONSTRAINT user_quests_pkey PRIMARY KEY (id);


--
-- Name: user_resource_inventory user_resource_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.user_resource_inventory
    ADD CONSTRAINT user_resource_inventory_pkey PRIMARY KEY (id);


--
-- Name: user_resource_inventory user_resource_inventory_wallet_address_resource_id_key; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.user_resource_inventory
    ADD CONSTRAINT user_resource_inventory_wallet_address_resource_id_key UNIQUE (wallet_address, resource_id);


--
-- Name: user_sector_activity user_sector_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.user_sector_activity
    ADD CONSTRAINT user_sector_activity_pkey PRIMARY KEY (wallet_address, sector_id, week_start);


--
-- Name: user_titles user_titles_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.user_titles
    ADD CONSTRAINT user_titles_pkey PRIMARY KEY (id);


--
-- Name: user_titles user_titles_user_wallet_title_code_key; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.user_titles
    ADD CONSTRAINT user_titles_user_wallet_title_code_key UNIQUE (user_wallet, title_code);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (wallet_address);


--
-- Name: users users_referral_code_key; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_referral_code_key UNIQUE (referral_code);


--
-- Name: war_bet_events war_bet_events_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.war_bet_events
    ADD CONSTRAINT war_bet_events_pkey PRIMARY KEY (id);


--
-- Name: war_bets war_bets_pkey; Type: CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.war_bets
    ADD CONSTRAINT war_bets_pkey PRIMARY KEY (id);


--
-- Name: idx_battles_attacker; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_battles_attacker ON public.battles USING btree (attacker);


--
-- Name: idx_battles_claim; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_battles_claim ON public.battles USING btree (claim_id);


--
-- Name: idx_battles_defender; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_battles_defender ON public.battles USING btree (defender);


--
-- Name: idx_bet_events_status; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_bet_events_status ON public.war_bet_events USING btree (event_type, status, closes_at);


--
-- Name: idx_bounties_status; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_bounties_status ON public.bounties USING btree (status) WHERE ((status)::text = 'active'::text);


--
-- Name: idx_bounties_target; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_bounties_target ON public.bounties USING btree (target_wallet, status) WHERE ((status)::text = 'active'::text);


--
-- Name: idx_chronicles_actor; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_chronicles_actor ON public.server_chronicles USING btree (actor_wallet, occurred_at DESC);


--
-- Name: idx_chronicles_event; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_chronicles_event ON public.server_chronicles USING btree (event_type, occurred_at DESC);


--
-- Name: idx_chronicles_public; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_chronicles_public ON public.server_chronicles USING btree (is_public, occurred_at DESC);


--
-- Name: idx_citizen_rewards_cycle; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_citizen_rewards_cycle ON public.citizen_rewards USING btree (payout_cycle);


--
-- Name: idx_citizen_rewards_wallet; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_citizen_rewards_wallet ON public.citizen_rewards USING btree (wallet_address);


--
-- Name: idx_claims_created_at; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_claims_created_at ON public.claims USING btree (created_at);


--
-- Name: idx_claims_owner; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_claims_owner ON public.claims USING btree (owner);


--
-- Name: idx_claims_sector_code; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_claims_sector_code ON public.claims USING btree (sector_code);


--
-- Name: idx_client_errors_created; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_client_errors_created ON public.client_errors USING btree (created_at DESC);


--
-- Name: idx_coinflip_wallet; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_coinflip_wallet ON public.coinflip_games USING btree (wallet);


--
-- Name: idx_crash_bets_round; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_crash_bets_round ON public.crash_bets USING btree (round_id);


--
-- Name: idx_crash_bets_round_id; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_crash_bets_round_id ON public.crash_bets USING btree (round_id);


--
-- Name: idx_crash_bets_wallet; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_crash_bets_wallet ON public.crash_bets USING btree (wallet);


--
-- Name: idx_crash_rounds_status; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_crash_rounds_status ON public.crash_rounds USING btree (status);


--
-- Name: idx_daily_logins_wallet; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_daily_logins_wallet ON public.daily_logins USING btree (wallet, login_date DESC);


--
-- Name: idx_daily_missions_wallet; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_daily_missions_wallet ON public.daily_missions USING btree (wallet, mission_date);


--
-- Name: idx_deposits_wallet; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_deposits_wallet ON public.deposits USING btree (wallet_address);


--
-- Name: idx_dice_wallet; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_dice_wallet ON public.dice_games USING btree (wallet);


--
-- Name: idx_enhancement_log_instance; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_enhancement_log_instance ON public.enhancement_log USING btree (instance_id);


--
-- Name: idx_enhancement_log_wallet; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_enhancement_log_wallet ON public.enhancement_log USING btree (wallet);


--
-- Name: idx_events_active; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_events_active ON public.events USING btree (active, starts_at, ends_at);


--
-- Name: idx_game_items_category; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_game_items_category ON public.game_items USING btree (category, active);


--
-- Name: idx_global_events_gov_active; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_global_events_gov_active ON public.global_events_gov USING btree (active, ends_at) WHERE (active = true);


--
-- Name: idx_gov_history_active; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_gov_history_active ON public.governance_history USING btree (ended_at) WHERE (ended_at IS NULL);


--
-- Name: idx_gov_history_sector; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_gov_history_sector ON public.governance_history USING btree (sector_id) WHERE (sector_id IS NOT NULL);


--
-- Name: idx_gov_history_wallet; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_gov_history_wallet ON public.governance_history USING btree (wallet);


--
-- Name: idx_gov_positions_role_sector; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_gov_positions_role_sector ON public.governance_positions USING btree (role, sector_id);


--
-- Name: idx_gov_positions_wallet; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_gov_positions_wallet ON public.governance_positions USING btree (wallet);


--
-- Name: idx_gov_transactions_sector; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_gov_transactions_sector ON public.governance_transactions USING btree (sector_id);


--
-- Name: idx_gov_transactions_wallet; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_gov_transactions_wallet ON public.governance_transactions USING btree (wallet);


--
-- Name: idx_governor_fees_sector; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_governor_fees_sector ON public.governor_fees USING btree (sector_id);


--
-- Name: idx_guild_invites_wallet; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_guild_invites_wallet ON public.guild_invites USING btree (invited_wallet, status);


--
-- Name: idx_guild_ledger_guild_time; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_guild_ledger_guild_time ON public.guild_treasury_ledger USING btree (guild_id, created_at DESC);


--
-- Name: idx_guild_members_wallet; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_guild_members_wallet ON public.guild_members USING btree (wallet);


--
-- Name: idx_guild_messages_guild_time; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_guild_messages_guild_time ON public.guild_messages USING btree (guild_id, created_at DESC);


--
-- Name: idx_guild_raids_guild_status; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_guild_raids_guild_status ON public.guild_raids USING btree (guild_id, status);


--
-- Name: idx_guild_wars_attacker; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_guild_wars_attacker ON public.guild_wars USING btree (attacker_guild_id);


--
-- Name: idx_guild_wars_defender; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_guild_wars_defender ON public.guild_wars USING btree (defender_guild_id);


--
-- Name: idx_guild_wars_status; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_guild_wars_status ON public.guild_wars USING btree (status);


--
-- Name: idx_guilds_leader; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_guilds_leader ON public.guilds USING btree (leader_wallet);


--
-- Name: idx_gwa_war; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_gwa_war ON public.guild_war_actions USING btree (war_id);


--
-- Name: idx_hilo_wallet_status; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_hilo_wallet_status ON public.hilo_games USING btree (wallet, status);


--
-- Name: idx_hof_category; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_hof_category ON public.hall_of_fame USING btree (category, achieved_at DESC);


--
-- Name: idx_hof_season; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_hof_season ON public.hall_of_fame USING btree (season_id, category);


--
-- Name: idx_hof_sector_code; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_hof_sector_code ON public.governor_hall_of_fame USING btree (sector_code);


--
-- Name: idx_hof_user_wallet; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_hof_user_wallet ON public.governor_hall_of_fame USING btree (user_wallet);


--
-- Name: idx_hof_wallet; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_hof_wallet ON public.hall_of_fame USING btree (user_wallet);


--
-- Name: idx_item_instances_level; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_item_instances_level ON public.item_instances USING btree (enhancement_level);


--
-- Name: idx_item_instances_type; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_item_instances_type ON public.item_instances USING btree (item_type_id);


--
-- Name: idx_item_instances_wallet; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_item_instances_wallet ON public.item_instances USING btree (wallet);


--
-- Name: idx_item_usage_wallet; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_item_usage_wallet ON public.item_usage_log USING btree (wallet);


--
-- Name: idx_job_buffs_job; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_job_buffs_job ON public.job_buffs USING btree (job_id, buff_key);


--
-- Name: idx_job_change_log_user; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_job_change_log_user ON public.job_change_log USING btree (user_id, changed_at);


--
-- Name: idx_loot_priority_wallet; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_loot_priority_wallet ON public.loot_priority_claims USING btree (wallet);


--
-- Name: idx_maintenance_log_processed; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_maintenance_log_processed ON public.maintenance_log USING btree (processed_at DESC);


--
-- Name: idx_maintenance_log_wallet; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_maintenance_log_wallet ON public.maintenance_log USING btree (wallet);


--
-- Name: idx_mars_weather_active; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_mars_weather_active ON public.mars_weather USING btree (active, starts_at, ends_at) WHERE (active = true);


--
-- Name: idx_mars_weather_sector; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_mars_weather_sector ON public.mars_weather USING btree (sector_id);


--
-- Name: idx_mines_games_wallet_status; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_mines_games_wallet_status ON public.mines_games USING btree (wallet, status);


--
-- Name: idx_mines_wallet; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_mines_wallet ON public.mines_games USING btree (wallet);


--
-- Name: idx_missions_origin_claim_active; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_missions_origin_claim_active ON public.missions USING btree (origin_claim_id) WHERE ((status)::text = ANY ((ARRAY['traveling'::character varying, 'complete'::character varying])::text[]));


--
-- Name: idx_missions_target_wallet; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_missions_target_wallet ON public.missions USING btree (target_wallet, status) WHERE (target_wallet IS NOT NULL);


--
-- Name: idx_missions_unclaimed; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_missions_unclaimed ON public.missions USING btree (status, start_time) WHERE ((status)::text = ANY ((ARRAY['traveling'::character varying, 'complete'::character varying])::text[]));


--
-- Name: idx_missions_wallet_status; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_missions_wallet_status ON public.missions USING btree (wallet, status);


--
-- Name: idx_mkt_claim; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_mkt_claim ON public.marketplace_listings USING btree (claim_id);


--
-- Name: idx_mkt_expires; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_mkt_expires ON public.marketplace_listings USING btree (expires_at);


--
-- Name: idx_mkt_instance; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_mkt_instance ON public.marketplace_listings USING btree (item_instance_id);


--
-- Name: idx_mkt_ph_type; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_mkt_ph_type ON public.marketplace_price_history USING btree (item_type_id, enhancement_level);


--
-- Name: idx_mkt_seller; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_mkt_seller ON public.marketplace_listings USING btree (seller);


--
-- Name: idx_mkt_status; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_mkt_status ON public.marketplace_listings USING btree (status);


--
-- Name: idx_mkt_type; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_mkt_type ON public.marketplace_listings USING btree (listing_type);


--
-- Name: idx_pixel_shields_claim; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_pixel_shields_claim ON public.pixel_shields USING btree (claim_id);


--
-- Name: idx_pixel_shields_owner; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_pixel_shields_owner ON public.pixel_shields USING btree (owner);


--
-- Name: idx_pixels_owner; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_pixels_owner ON public.pixels USING btree (owner);


--
-- Name: idx_pixels_sector; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_pixels_sector ON public.pixels USING btree (sector_id);


--
-- Name: idx_pois_active; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_pois_active ON public.exploration_pois USING btree (active, expires_at) WHERE (active = true);


--
-- Name: idx_pois_sector; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_pois_sector ON public.exploration_pois USING btree (sector_id);


--
-- Name: idx_referral_rewards_from; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_referral_rewards_from ON public.referral_rewards USING btree (from_wallet);


--
-- Name: idx_referral_rewards_to; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_referral_rewards_to ON public.referral_rewards USING btree (to_wallet);


--
-- Name: idx_reset_tokens_email; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_reset_tokens_email ON public.password_reset_tokens USING btree (email);


--
-- Name: idx_reset_tokens_token; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_reset_tokens_token ON public.password_reset_tokens USING btree (token);


--
-- Name: idx_resource_inv_wallet; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_resource_inv_wallet ON public.user_resource_inventory USING btree (wallet_address);


--
-- Name: idx_rocket_events_status; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_rocket_events_status ON public.rocket_events USING btree (status) WHERE ((status)::text <> 'completed'::text);


--
-- Name: idx_season_rewards_wallet; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_season_rewards_wallet ON public.season_rewards USING btree (wallet, claimed);


--
-- Name: idx_season_scores_season; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_season_scores_season ON public.season_scores USING btree (season_id, score DESC);


--
-- Name: idx_season_scores_wallet; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_season_scores_wallet ON public.season_scores USING btree (wallet);


--
-- Name: idx_seasons_active; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_seasons_active ON public.seasons USING btree (active);


--
-- Name: idx_sector_buffs_active; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_sector_buffs_active ON public.sector_buffs USING btree (sector_id, active) WHERE (active = true);


--
-- Name: idx_sector_defs_type; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_sector_defs_type ON public.sector_definitions USING btree (sector_type);


--
-- Name: idx_sector_gov_wallet; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_sector_gov_wallet ON public.sector_governance USING btree (governor_wallet);


--
-- Name: idx_sectors_tier; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_sectors_tier ON public.sectors USING btree (tier);


--
-- Name: idx_sieges_challenger; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_sieges_challenger ON public.governor_sieges USING btree (challenger_wallet);


--
-- Name: idx_sieges_ends_at; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_sieges_ends_at ON public.governor_sieges USING btree (siege_ends_at) WHERE ((status)::text = ANY ((ARRAY['active'::character varying, 'pending'::character varying])::text[]));


--
-- Name: idx_sieges_sector_status; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_sieges_sector_status ON public.governor_sieges USING btree (sector_code, status);


--
-- Name: idx_starlink_active; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_starlink_active ON public.starlink_passes USING btree (active, ends_at) WHERE (active = true);


--
-- Name: idx_titles_wallet; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_titles_wallet ON public.user_titles USING btree (user_wallet);


--
-- Name: idx_transactions_created; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_transactions_created ON public.transactions USING btree (created_at DESC);


--
-- Name: idx_transactions_from; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_transactions_from ON public.transactions USING btree (from_wallet);


--
-- Name: idx_transactions_type; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_transactions_type ON public.transactions USING btree (type);


--
-- Name: idx_transactions_type_created; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_transactions_type_created ON public.transactions USING btree (type, created_at);


--
-- Name: idx_user_cosmetics_claim; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_user_cosmetics_claim ON public.user_cosmetics USING btree (claim_id);


--
-- Name: idx_user_cosmetics_wallet; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_user_cosmetics_wallet ON public.user_cosmetics USING btree (wallet);


--
-- Name: idx_user_effects_active; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_user_effects_active ON public.user_active_effects USING btree (wallet, active) WHERE (active = true);


--
-- Name: idx_user_items_wallet; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_user_items_wallet ON public.user_items USING btree (wallet);


--
-- Name: idx_user_onboarding_completed; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_user_onboarding_completed ON public.user_onboarding USING btree (completed, skipped);


--
-- Name: idx_user_onboarding_wallet; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_user_onboarding_wallet ON public.user_onboarding USING btree (wallet_address);


--
-- Name: idx_user_quests_status; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_user_quests_status ON public.user_quests USING btree (wallet, status);


--
-- Name: idx_user_quests_wallet; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_user_quests_wallet ON public.user_quests USING btree (wallet);


--
-- Name: idx_user_sector_activity_sector; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_user_sector_activity_sector ON public.user_sector_activity USING btree (sector_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_guild; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_users_guild ON public.users USING btree (guild_id);


--
-- Name: idx_users_job; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_users_job ON public.users USING btree (current_job_id);


--
-- Name: idx_users_rank; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_users_rank ON public.users USING btree (rank_level DESC);


--
-- Name: idx_users_referral_code; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_users_referral_code ON public.users USING btree (referral_code);


--
-- Name: idx_users_referred_by; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_users_referred_by ON public.users USING btree (referred_by);


--
-- Name: idx_users_xp; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_users_xp ON public.users USING btree (xp DESC);


--
-- Name: idx_war_bets_event; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_war_bets_event ON public.war_bets USING btree (event_id);


--
-- Name: idx_war_bets_user; Type: INDEX; Schema: public; Owner: jongho
--

CREATE INDEX idx_war_bets_user ON public.war_bets USING btree (user_wallet);


--
-- Name: idx_war_bets_user_event; Type: INDEX; Schema: public; Owner: jongho
--

CREATE UNIQUE INDEX idx_war_bets_user_event ON public.war_bets USING btree (event_id, user_wallet);


--
-- Name: citizen_rewards citizen_rewards_sector_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.citizen_rewards
    ADD CONSTRAINT citizen_rewards_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES public.sectors(id);


--
-- Name: claims claims_sector_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.claims
    ADD CONSTRAINT claims_sector_code_fkey FOREIGN KEY (sector_code) REFERENCES public.sector_definitions(code);


--
-- Name: crash_bets crash_bets_round_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.crash_bets
    ADD CONSTRAINT crash_bets_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.crash_rounds(id);


--
-- Name: enhancement_log enhancement_log_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.enhancement_log
    ADD CONSTRAINT enhancement_log_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.item_instances(id) ON DELETE CASCADE;


--
-- Name: exploration_pois exploration_pois_sector_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.exploration_pois
    ADD CONSTRAINT exploration_pois_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES public.sectors(id) ON DELETE SET NULL;


--
-- Name: governance_history fk_gh_sector; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.governance_history
    ADD CONSTRAINT fk_gh_sector FOREIGN KEY (sector_id) REFERENCES public.sectors(id) ON DELETE SET NULL;


--
-- Name: governance_positions governance_positions_sector_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.governance_positions
    ADD CONSTRAINT governance_positions_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES public.sectors(id);


--
-- Name: governor_fees governor_fees_sector_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.governor_fees
    ADD CONSTRAINT governor_fees_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES public.sectors(id);


--
-- Name: governor_hall_of_fame governor_hall_of_fame_user_wallet_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.governor_hall_of_fame
    ADD CONSTRAINT governor_hall_of_fame_user_wallet_fkey FOREIGN KEY (user_wallet) REFERENCES public.users(wallet_address);


--
-- Name: governor_sieges governor_sieges_betting_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.governor_sieges
    ADD CONSTRAINT governor_sieges_betting_event_id_fkey FOREIGN KEY (betting_event_id) REFERENCES public.war_bet_events(id);


--
-- Name: governor_sieges governor_sieges_challenger_wallet_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.governor_sieges
    ADD CONSTRAINT governor_sieges_challenger_wallet_fkey FOREIGN KEY (challenger_wallet) REFERENCES public.users(wallet_address);


--
-- Name: governor_sieges governor_sieges_defender_wallet_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.governor_sieges
    ADD CONSTRAINT governor_sieges_defender_wallet_fkey FOREIGN KEY (defender_wallet) REFERENCES public.users(wallet_address);


--
-- Name: governor_sieges governor_sieges_sector_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.governor_sieges
    ADD CONSTRAINT governor_sieges_sector_code_fkey FOREIGN KEY (sector_code) REFERENCES public.sector_definitions(code);


--
-- Name: guild_invites guild_invites_guild_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.guild_invites
    ADD CONSTRAINT guild_invites_guild_id_fkey FOREIGN KEY (guild_id) REFERENCES public.guilds(id) ON DELETE CASCADE;


--
-- Name: guild_members guild_members_guild_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.guild_members
    ADD CONSTRAINT guild_members_guild_id_fkey FOREIGN KEY (guild_id) REFERENCES public.guilds(id) ON DELETE CASCADE;


--
-- Name: guild_messages guild_messages_guild_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.guild_messages
    ADD CONSTRAINT guild_messages_guild_id_fkey FOREIGN KEY (guild_id) REFERENCES public.guilds(id) ON DELETE CASCADE;


--
-- Name: guild_raids guild_raids_guild_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.guild_raids
    ADD CONSTRAINT guild_raids_guild_id_fkey FOREIGN KEY (guild_id) REFERENCES public.guilds(id) ON DELETE CASCADE;


--
-- Name: guild_treasury_ledger guild_treasury_ledger_guild_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.guild_treasury_ledger
    ADD CONSTRAINT guild_treasury_ledger_guild_id_fkey FOREIGN KEY (guild_id) REFERENCES public.guilds(id) ON DELETE CASCADE;


--
-- Name: guild_war_actions guild_war_actions_war_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.guild_war_actions
    ADD CONSTRAINT guild_war_actions_war_id_fkey FOREIGN KEY (war_id) REFERENCES public.guild_wars(id) ON DELETE CASCADE;


--
-- Name: guild_wars guild_wars_attacker_guild_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.guild_wars
    ADD CONSTRAINT guild_wars_attacker_guild_id_fkey FOREIGN KEY (attacker_guild_id) REFERENCES public.guilds(id) ON DELETE CASCADE;


--
-- Name: guild_wars guild_wars_defender_guild_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.guild_wars
    ADD CONSTRAINT guild_wars_defender_guild_id_fkey FOREIGN KEY (defender_guild_id) REFERENCES public.guilds(id) ON DELETE CASCADE;


--
-- Name: hall_of_fame hall_of_fame_guild_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.hall_of_fame
    ADD CONSTRAINT hall_of_fame_guild_id_fkey FOREIGN KEY (guild_id) REFERENCES public.guilds(id) ON DELETE SET NULL;


--
-- Name: hall_of_fame hall_of_fame_user_wallet_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.hall_of_fame
    ADD CONSTRAINT hall_of_fame_user_wallet_fkey FOREIGN KEY (user_wallet) REFERENCES public.users(wallet_address) ON DELETE SET NULL;


--
-- Name: item_instances item_instances_item_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.item_instances
    ADD CONSTRAINT item_instances_item_type_id_fkey FOREIGN KEY (item_type_id) REFERENCES public.item_types(id);


--
-- Name: item_usage_log item_usage_log_item_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.item_usage_log
    ADD CONSTRAINT item_usage_log_item_type_id_fkey FOREIGN KEY (item_type_id) REFERENCES public.item_types(id);


--
-- Name: job_buffs job_buffs_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.job_buffs
    ADD CONSTRAINT job_buffs_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: job_change_log job_change_log_from_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.job_change_log
    ADD CONSTRAINT job_change_log_from_job_id_fkey FOREIGN KEY (from_job_id) REFERENCES public.jobs(id);


--
-- Name: job_change_log job_change_log_to_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.job_change_log
    ADD CONSTRAINT job_change_log_to_job_id_fkey FOREIGN KEY (to_job_id) REFERENCES public.jobs(id);


--
-- Name: job_change_log job_change_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.job_change_log
    ADD CONSTRAINT job_change_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(wallet_address);


--
-- Name: marketplace_listings marketplace_listings_claim_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.marketplace_listings
    ADD CONSTRAINT marketplace_listings_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES public.claims(id) ON DELETE SET NULL;


--
-- Name: marketplace_listings marketplace_listings_item_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.marketplace_listings
    ADD CONSTRAINT marketplace_listings_item_instance_id_fkey FOREIGN KEY (item_instance_id) REFERENCES public.item_instances(id) ON DELETE SET NULL;


--
-- Name: marketplace_listings marketplace_listings_resource_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.marketplace_listings
    ADD CONSTRAINT marketplace_listings_resource_code_fkey FOREIGN KEY (resource_code) REFERENCES public.resources(code);


--
-- Name: mars_weather mars_weather_sector_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.mars_weather
    ADD CONSTRAINT mars_weather_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES public.sectors(id) ON DELETE CASCADE;


--
-- Name: missions missions_origin_claim_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_origin_claim_id_fkey FOREIGN KEY (origin_claim_id) REFERENCES public.claims(id) ON DELETE SET NULL;


--
-- Name: pixels pixels_sector_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.pixels
    ADD CONSTRAINT pixels_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES public.sectors(id);


--
-- Name: poi_discoveries poi_discoveries_poi_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.poi_discoveries
    ADD CONSTRAINT poi_discoveries_poi_id_fkey FOREIGN KEY (poi_id) REFERENCES public.exploration_pois(id) ON DELETE CASCADE;


--
-- Name: rocket_events rocket_events_sector_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.rocket_events
    ADD CONSTRAINT rocket_events_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES public.sectors(id) ON DELETE SET NULL;


--
-- Name: rocket_loot_claims rocket_loot_claims_rocket_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.rocket_loot_claims
    ADD CONSTRAINT rocket_loot_claims_rocket_event_id_fkey FOREIGN KEY (rocket_event_id) REFERENCES public.rocket_events(id) ON DELETE CASCADE;


--
-- Name: season_pass_progress season_pass_progress_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.season_pass_progress
    ADD CONSTRAINT season_pass_progress_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.seasons(id) ON DELETE CASCADE;


--
-- Name: season_pass_tiers season_pass_tiers_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.season_pass_tiers
    ADD CONSTRAINT season_pass_tiers_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.seasons(id) ON DELETE CASCADE;


--
-- Name: season_rewards season_rewards_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.season_rewards
    ADD CONSTRAINT season_rewards_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.seasons(id) ON DELETE CASCADE;


--
-- Name: season_scores season_scores_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.season_scores
    ADD CONSTRAINT season_scores_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.seasons(id) ON DELETE CASCADE;


--
-- Name: sector_buffs sector_buffs_sector_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.sector_buffs
    ADD CONSTRAINT sector_buffs_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES public.sectors(id);


--
-- Name: sector_entry_requirements sector_entry_requirements_sector_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.sector_entry_requirements
    ADD CONSTRAINT sector_entry_requirements_sector_code_fkey FOREIGN KEY (sector_code) REFERENCES public.sector_definitions(code);


--
-- Name: sector_governance sector_governance_active_siege_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.sector_governance
    ADD CONSTRAINT sector_governance_active_siege_id_fkey FOREIGN KEY (active_siege_id) REFERENCES public.governor_sieges(id);


--
-- Name: sector_governance sector_governance_governor_wallet_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.sector_governance
    ADD CONSTRAINT sector_governance_governor_wallet_fkey FOREIGN KEY (governor_wallet) REFERENCES public.users(wallet_address);


--
-- Name: sector_governance sector_governance_sector_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.sector_governance
    ADD CONSTRAINT sector_governance_sector_code_fkey FOREIGN KEY (sector_code) REFERENCES public.sector_definitions(code);


--
-- Name: sector_resource_rates sector_resource_rates_resource_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.sector_resource_rates
    ADD CONSTRAINT sector_resource_rates_resource_code_fkey FOREIGN KEY (resource_code) REFERENCES public.resources(code);


--
-- Name: server_chronicles server_chronicles_actor_wallet_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.server_chronicles
    ADD CONSTRAINT server_chronicles_actor_wallet_fkey FOREIGN KEY (actor_wallet) REFERENCES public.users(wallet_address) ON DELETE SET NULL;


--
-- Name: server_chronicles server_chronicles_guild_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.server_chronicles
    ADD CONSTRAINT server_chronicles_guild_id_fkey FOREIGN KEY (guild_id) REFERENCES public.guilds(id) ON DELETE SET NULL;


--
-- Name: server_chronicles server_chronicles_target_wallet_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.server_chronicles
    ADD CONSTRAINT server_chronicles_target_wallet_fkey FOREIGN KEY (target_wallet) REFERENCES public.users(wallet_address) ON DELETE SET NULL;


--
-- Name: starlink_passes starlink_passes_sector_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.starlink_passes
    ADD CONSTRAINT starlink_passes_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES public.sectors(id) ON DELETE CASCADE;


--
-- Name: user_items user_items_item_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.user_items
    ADD CONSTRAINT user_items_item_type_id_fkey FOREIGN KEY (item_type_id) REFERENCES public.item_types(id);


--
-- Name: user_mining user_mining_wallet_address_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.user_mining
    ADD CONSTRAINT user_mining_wallet_address_fkey FOREIGN KEY (wallet_address) REFERENCES public.users(wallet_address);


--
-- Name: user_onboarding user_onboarding_wallet_address_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.user_onboarding
    ADD CONSTRAINT user_onboarding_wallet_address_fkey FOREIGN KEY (wallet_address) REFERENCES public.users(wallet_address) ON DELETE CASCADE;


--
-- Name: user_quests user_quests_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.user_quests
    ADD CONSTRAINT user_quests_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.quest_templates(id);


--
-- Name: user_resource_inventory user_resource_inventory_resource_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.user_resource_inventory
    ADD CONSTRAINT user_resource_inventory_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resources(id) ON DELETE CASCADE;


--
-- Name: user_resource_inventory user_resource_inventory_wallet_address_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.user_resource_inventory
    ADD CONSTRAINT user_resource_inventory_wallet_address_fkey FOREIGN KEY (wallet_address) REFERENCES public.users(wallet_address) ON DELETE CASCADE;


--
-- Name: user_sector_activity user_sector_activity_sector_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.user_sector_activity
    ADD CONSTRAINT user_sector_activity_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES public.sectors(id);


--
-- Name: user_titles user_titles_user_wallet_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.user_titles
    ADD CONSTRAINT user_titles_user_wallet_fkey FOREIGN KEY (user_wallet) REFERENCES public.users(wallet_address) ON DELETE CASCADE;


--
-- Name: users users_current_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_current_job_id_fkey FOREIGN KEY (current_job_id) REFERENCES public.jobs(id);


--
-- Name: war_bets war_bets_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.war_bets
    ADD CONSTRAINT war_bets_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.war_bet_events(id) ON DELETE CASCADE;


--
-- Name: war_bets war_bets_user_wallet_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jongho
--

ALTER TABLE ONLY public.war_bets
    ADD CONSTRAINT war_bets_user_wallet_fkey FOREIGN KEY (user_wallet) REFERENCES public.users(wallet_address);


--
-- PostgreSQL database dump complete
--

\unrestrict n4S1ZTzobfBi5UwSBSoXlvCX9hf1ndHDbTHPpguOiewGrwjAAyI6gBEYDqYRJge

