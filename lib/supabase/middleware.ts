import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Create a Supabase client configured to use cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not hit the DB here (e.g. getUser()) unless protecting a route.
  // Refreshing the auth token early
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const url = request.nextUrl.clone()
  const isAuthRoute = url.pathname === '/login' || url.pathname === '/reset-password'

  // If user is not logged in and not on an auth route, redirect to login
  if (
    !user &&
    !isAuthRoute &&
    !url.pathname.startsWith('/api/sync') && // allow webhooks
    url.pathname !== '/'
  ) {
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // If logged in and on the login page, go to dashboard
  if (user && isAuthRoute) {
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Admin and specific protections will be handled in route loaders/actions
  // as per the requirement: "middleware is not enough..."

  return supabaseResponse
}
