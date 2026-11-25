import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ParticleSphere from '../components/ParticleSphere';

const Register = () => {
  const navigate = useNavigate();
  const { register: registerUser } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    watch,
  } = useForm();

  const password = watch('password');

  const onSubmit = async (values) => {
    try {
      await registerUser({
        name: values.name,
        email: values.email,
        password: values.password,
        phone: values.phone,
      });
      navigate('/patient/dashboard');
    } catch (error) {
      const message = error.response?.data?.message || 'Unable to register right now.';
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
              <h1 id="auth-heading">A little more connected, every day.</h1>
              <p>Keep your readings, care team, and next steps together in one place.</p>
            </div>
          </div>
          <p className="auth-disclaimer">A demonstration experience using fake data only.</p>
        </section>

        <main className="auth-form-side">
          <div className="auth-card auth-card-register">
        <div className="mb-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-indigo-600">Join now</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Create patient account</h1>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Full name</label>
            <input
              type="text"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-indigo-500 focus:outline-none"
              {...register('name', { required: 'Full name is required', minLength: { value: 2, message: 'Name must be at least 2 characters' } })}
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-indigo-500 focus:outline-none"
              {...register('email', {
                required: 'Email is required',
                pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email address' },
              })}
            />
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
            <input
              type="tel"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-indigo-500 focus:outline-none"
              {...register('phone')}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-indigo-500 focus:outline-none"
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 8, message: 'Password must be at least 8 characters' },
                pattern: {
                  value: /^(?=.*[A-Za-z])(?=.*\d).+$/,
                  message: 'Password must include letters and numbers',
                },
              })}
            />
            {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Confirm password</label>
            <input
              type="password"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-indigo-500 focus:outline-none"
              {...register('confirmPassword', {
                required: 'Please confirm your password',
                validate: (value) => value === password || 'Passwords do not match',
              })}
            />
            {errors.confirmPassword && <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>}
          </div>

          {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300"
          >
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-500">
            Sign in
          </Link>
        </p>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Register;
