async function main() {
  const res = await fetch('https://mhuxrnxajtiwxauhlhlv.supabase.co/functions/v1/check-metricool-blogs');
  const data = await res.json();
  data.forEach(b => console.log(JSON.stringify(b)));
}
main().catch(console.error);
