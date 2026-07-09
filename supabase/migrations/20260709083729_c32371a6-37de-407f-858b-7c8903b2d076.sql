REVOKE EXECUTE ON FUNCTION public.get_portfolio_milestone_timeline(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_portfolio_milestone_timeline(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_portfolio_milestone_timeline(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_portfolio_milestone_timeline(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_portfolio_dashboard(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_portfolio_dashboard(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_portfolio_dashboard(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_portfolio_dashboard(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_portfolio_summary(uuid, date, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_portfolio_summary(uuid, date, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_portfolio_summary(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_portfolio_summary(uuid, date, date) TO service_role;