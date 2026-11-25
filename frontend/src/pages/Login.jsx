import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ParticleSphere from '../components/ParticleSphere';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm();

  const onSubmit = async (values) => {
    try {
      const response = await login(values);
      const userRole = response?.data?.user?.role;

      if (['patient', 'doctor', 'admin'].includes(userRole)) {
        navigate(`/${userRole}/dashboard`);
      } else {
        setError('root', { message: 'Your account has an invalid role. Contact an administrator.' });
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Unable to sign in right now.';
      setError('root', { message });
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-layout">
        <section className="auth-visual" aria-labelledby="auth-heading">
          <div className="auth-orb-wrap">
            <ParticleSphere />
            <div className="auth-orb-copy">
              <span className="auth-eyebrow">CAREHUB · REMOTE MONITORING</span>
              <h1 id="auth-heading">Care that stays connected.</h1>
              <p>Small daily check-ins. A clearer picture of your health, wherever you are.</p>
            </div>
          </div>
          <p className="auth-disclaimer">A demonstration experience using fake data only.</p>
        </section>

        <main className="auth-form-side">
          <div className="auth-card">
        <div className="mb-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-indigo-600">Chronic care</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Welcome back</h1>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label htmlFor="login-email" className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'login-email-error' : undefined}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-indigo-500 focus:outline-none"
              {...register('email', {
                required: 'Email is required',
                pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email address' },
              })}
            />
            {errors.email && <p id="login-email-error" role="alert" className="mt-1 text-sm text-red-800">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="login-password" className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'login-password-error' : undefined}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-indigo-500 focus:outline-none"
              {...register('password', { required: 'Password is required' })}
            />
            {errors.password && <p id="login-password-error" role="alert" className="mt-1 text-sm text-red-800">{errors.password.message}</p>}
          </div>

          {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300"
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-600">
          Need an account?{' '}
          <Link to="/register" className="font-semibold text-indigo-600 hover:text-indigo-500">
            Create one
          </Link>
        </p>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Login;
