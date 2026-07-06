import nigeriaLocations from 'naija-state-local-government';

const nigeriaStates = nigeriaLocations.states();
const nigeriaLgasByState = Object.fromEntries(
  nigeriaStates.map((state) => [state, nigeriaLocations.lgas(state)]),
);

export function buildSellerRegistrationHtml({
  publicSupabaseKey,
  publicSupabaseUrl,
  sellerPortalPath,
}) {
  return `<div class="registration-page">
    <section class="page-hero">
      <div class="shell">
        <p class="section-kicker">Seller onboarding</p>
        <h1>Create a store owner account after email verification.</h1>
        <p class="hero-lead">Apply as a customer or store owner, choose Free or Gold, and finish signup only after your email code is confirmed.</p>
        <div class="store-row mobile-web-hidden">
          <a class="primary-link" href="/${sellerPortalPath}/">Seller login</a>
        </div>
      </div>
    </section>

    <section class="section tight">
      <div class="shell desktop-web-only-message">
        <div class="desktop-web-message-card">
          <h2>Seller tools are desktop only</h2>
          <p>Seller login and business registration are only available on laptop or desktop. Please use a larger screen to continue.</p>
        </div>
      </div>
      <div class="shell application-grid seller-desktop-only">
        <aside class="application-panel">
          <p class="section-kicker">Before approval</p>
          <h2>What View2Connect will check.</h2>
          <p class="section-copy">
            Every seller can apply, including people selling only a few items. We review identity,
            pickup details, product readiness, and the ability to fulfil confirmed orders.
          </p>
          <div class="application-list">
            <div><strong>Separate accounts</strong><span>Your customer, store owner, and dispatch accounts stay separate.</span></div>
            <div><strong>Admin review</strong><span>Your dashboard opens after signup, but listings remain private until the application and each item are approved.</span></div>
            <div><strong>After approval</strong><span>Add products manually or import a CSV/Excel catalog from the seller dashboard.</span></div>
          </div>
        </aside>

        <article class="application-panel">
          <div class="onboarding-progress">
            <div class="progress-step active" data-progress-step="1">1. Seller type</div>
            <div class="progress-step" data-progress-step="2">2. Details</div>
            <div class="progress-step" data-progress-step="3">3. Plan</div>
            <div class="progress-step" data-progress-step="4">4. Account</div>
          </div>

          <section class="business-form" data-seller-type-step>
            <div>
              <p class="section-kicker">Choose seller type</p>
              <h2>How would you like to sell?</h2>
              <p class="form-note">Customer login stays separate. Store owner signup is for sellers only.</p>
            </div>
            <div class="seller-type-grid">
              <button class="seller-type-card" type="button" data-customer-login>
                <span class="seller-type-icon">I</span>
                <strong>Customer</strong>
                <span>Go to the customer login and shopping app.</span>
              </button>
              <button class="seller-type-card" type="button" data-seller-type="store">
                <span class="seller-type-icon">S</span>
                <strong>Store owner</strong>
                <span>Bring an existing shop, food business, or product catalog online.</span>
              </button>
            </div>
          </section>

          <form class="business-form" data-business-registration-form hidden>
            <div>
              <p class="section-kicker">Application details</p>
              <h2 data-application-title>Tell us about your store.</h2>
              <p class="form-note">The email entered here becomes the dedicated store owner login after verification.</p>
              <button class="secondary-link" type="button" data-fill-random-seller>Fill random test details</button>
              <p class="form-note">Testing keeps the email empty so you can use an inbox that receives the OTP.</p>
            </div>
            <input name="sellerType" type="hidden" />
            <div class="form-grid">
              <div class="field">
                <label for="ownerName">Owner full name</label>
                <input id="ownerName" name="ownerName" autocomplete="name" required />
              </div>
              <div class="field">
                <label for="businessName" data-business-name-label>Business or store name</label>
                <input id="businessName" name="businessName" required />
              </div>
              <div class="field">
                <label for="email">Email</label>
                <input id="email" name="email" type="email" autocomplete="email" required />
              </div>
              <div class="field">
                <label for="phone">Phone / WhatsApp</label>
                <input id="phone" name="phone" autocomplete="tel" required />
              </div>
              <div class="field" data-store-only>
                <label for="businessType">Business type</label>
                <select id="businessType" name="businessType" required>
                  <option value="">Select type</option>
                  <option>Supermarket / grocery store</option>
                  <option>Food vendor / restaurant</option>
                  <option>Pharmacy / health store</option>
                  <option>Cosmetics / beauty store</option>
                  <option>Service provider</option>
                  <option>Other retail store</option>
                </select>
              </div>
              <div class="field">
                <label for="state">State</label>
                <select id="state" name="state" required>
                  <option value="">Select state</option>
                  ${nigeriaStates.map((state) => `<option value="${state}">${state}</option>`).join('')}
                </select>
              </div>
              <div class="field">
                <label for="area">Local government area</label>
                <select id="area" name="area" disabled required>
                  <option value="">Select state first</option>
                </select>
              </div>
              <div class="field full">
                <label for="address">Street / pickup address</label>
                <input id="address" name="address" autocomplete="street-address" placeholder="House number, street, landmark" required />
              </div>
              <div class="field" data-store-only>
                <label for="cacNumber">CAC number</label>
                <input id="cacNumber" name="cacNumber" placeholder="Optional during early application" />
              </div>
              <div class="field" data-store-only>
                <label for="posSystem">POS or inventory system</label>
                <input id="posSystem" name="posSystem" placeholder="Prestige, Excel, manual, none" />
              </div>
              <div class="field" data-store-only>
                <label for="catalogReady">Product list status</label>
                <select id="catalogReady" name="catalogReady" required>
                  <option value="">Select status</option>
                  <option>I can export CSV or Excel</option>
                  <option>I have a product list but no export</option>
                  <option>I need help creating a product list</option>
                  <option>I sell services, not products</option>
                </select>
              </div>
              <div class="field full">
                <label for="notes">What do you sell?</label>
                <textarea id="notes" name="notes" required placeholder="Mention your main products, expected stock, food or menu type, and how orders can be collected."></textarea>
              </div>
            </div>
            <div class="form-actions">
              <button class="secondary-link" type="button" data-back-to-type>Back</button>
              <button class="primary-link" type="submit">Continue to plans</button>
            </div>
          </form>

          <form class="business-form" data-plan-step hidden>
            <div>
              <p class="section-kicker">Launch plan</p>
              <h2>Choose Free or Gold.</h2>
              <p class="form-note">Start free now. Gold payment is requested only after admin reviews the application.</p>
            </div>
            <div class="plan-recommendation">
              <div>
                <strong>Recommended: start with Free</strong>
                <p class="form-note">Learn the seller workflow before paying for priority placement.</p>
              </div>
            </div>
            <div class="plan-grid">
              <label class="plan-card">
                <input name="plan" type="radio" value="free" checked required />
                <strong>Free Plan</strong>
                <span class="plan-price">NGN 0</span>
                <span>Three months for new sellers.</span>
                <ul class="plan-benefits">
                  <li>Dedicated seller dashboard</li>
                  <li>Manual product posting and order tools</li>
                  <li>Admin review for every listing</li>
                  <li>Standard placement below paid stores</li>
                </ul>
              </label>
              <label class="plan-card">
                <input name="plan" type="radio" value="gold" required />
                <strong>Gold Plan</strong>
                <span class="plan-price" data-gold-price>NGN 15,000</span>
                <span data-gold-duration>Three months for a store or food business.</span>
                <ul class="plan-benefits">
                  <li>Everything included in Free</li>
                  <li>Priority placement after approval and payment</li>
                  <li>CSV/Excel catalog import</li>
                  <li>Longer visibility and faster catalog setup</li>
                </ul>
              </label>
            </div>
            <div class="form-actions">
              <button class="secondary-link" type="button" data-back-to-details>Back</button>
              <button class="primary-link" type="submit" data-plan-continue>Start with Free Plan</button>
            </div>
          </form>

          <form class="business-form" data-account-step hidden>
            <div>
              <p class="section-kicker">Secure account</p>
              <h2>Create your seller login.</h2>
              <p class="form-note">We will email a one-time code. Your store owner account is created only after the correct code is entered.</p>
            </div>
            <div class="account-summary">
              <strong data-account-business>Seller application</strong>
              <span data-account-plan>Free Plan</span>
            </div>
            <div class="form-grid">
              <div class="field full">
                <label for="accountEmail">Login email</label>
                <input id="accountEmail" name="accountEmail" type="email" readonly />
              </div>
              <div class="field">
                <label for="accountPassword">Password</label>
                <input id="accountPassword" name="password" type="password" autocomplete="new-password" minlength="8" required />
              </div>
              <div class="field">
                <label for="confirmAccountPassword">Confirm password</label>
                <input id="confirmAccountPassword" name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required />
              </div>
            </div>
            <label class="plan-recommendation">
              <input name="agreement" type="checkbox" required />
              <span>I agree to the View2Connect user agreement, privacy policy, seller review, and plan rules.</span>
            </label>
            <p class="form-status" data-account-status hidden></p>
            <div class="form-actions">
              <button class="secondary-link" type="button" data-back-to-plan>Back</button>
              <button class="primary-link" type="submit" data-create-account>Create account</button>
            </div>
          </form>
        </article>
      </div>
    </section>
  </div>

  <div class="otp-modal" data-otp-modal hidden>
    <div class="otp-dialog" role="dialog" aria-modal="true" aria-labelledby="seller-otp-title">
      <div>
        <p class="section-kicker">Email verification</p>
        <h2 id="seller-otp-title">Enter your email OTP.</h2>
        <p class="form-note">The code was sent to <strong data-otp-email></strong>. The account remains uncreated until this code is correct.</p>
      </div>
      <input class="otp-code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="000000" aria-label="Seller verification code" data-otp-code />
      <p class="form-status" data-otp-status hidden></p>
      <div class="otp-actions">
        <button class="secondary-link" type="button" data-resend-otp>Resend / reset code</button>
        <button class="primary-link" type="button" data-verify-otp>Verify and continue</button>
      </div>
      <button class="secondary-link" type="button" data-close-otp>Cancel</button>
    </div>
  </div>

  <script>
    (() => {
      const supabaseUrl = ${JSON.stringify(publicSupabaseUrl)};
      const supabaseKey = ${JSON.stringify(publicSupabaseKey)};
      const nigeriaLgasByState = ${JSON.stringify(nigeriaLgasByState)};
      const typeStep = document.querySelector('[data-seller-type-step]');
      const detailsForm = document.querySelector('[data-business-registration-form]');
      const planStep = document.querySelector('[data-plan-step]');
      const accountStep = document.querySelector('[data-account-step]');
      const accountStatus = document.querySelector('[data-account-status]');
      const progressSteps = [...document.querySelectorAll('[data-progress-step]')];
      const typeButtons = [...document.querySelectorAll('[data-seller-type]')];
      const customerLoginButton = document.querySelector('[data-customer-login]');
      const storeOnlyFields = [...document.querySelectorAll('[data-store-only]')];
      const planInputs = [...document.querySelectorAll('input[name="plan"]')];
      const planContinue = document.querySelector('[data-plan-continue]');
      const otpModal = document.querySelector('[data-otp-modal]');
      const otpCode = document.querySelector('[data-otp-code]');
      const otpStatus = document.querySelector('[data-otp-status]');
      const createAccountButton = document.querySelector('[data-create-account]');
      const verifyOtpButton = document.querySelector('[data-verify-otp]');
      const resendOtpButton = document.querySelector('[data-resend-otp]');
      const randomSellerButton = document.querySelector('[data-fill-random-seller]');
      const stateSelect = document.querySelector('#state');
      const areaSelect = document.querySelector('#area');
      let sellerType = '';
      let selectedPlan = 'free';

      if (!typeStep || !detailsForm || !planStep || !accountStep || !otpModal) return;

      const setStatus = (element, message, isError = false) => {
        if (!element) return;
        element.hidden = !message;
        element.textContent = message;
        element.style.color = isError ? '#b42318' : '';
        element.style.borderColor = isError ? '#f0a4a0' : '';
        element.style.background = isError ? '#fff1f0' : '';
      };

      const setLoading = (button, loading, loadingLabel) => {
        if (!button) return;
        if (loading) {
          button.dataset.originalLabel = button.textContent || '';
          button.textContent = loadingLabel;
          button.classList.add('button-loading');
          button.disabled = true;
          return;
        }
        button.textContent = button.dataset.originalLabel || button.textContent;
        button.classList.remove('button-loading');
        button.disabled = false;
      };

      const showStep = (step) => {
        typeStep.hidden = step !== 1;
        detailsForm.hidden = step !== 2;
        planStep.hidden = step !== 3;
        accountStep.hidden = step !== 4;
        progressSteps.forEach((item) => {
          item.classList.toggle('active', item.dataset.progressStep === String(step));
        });
        document.querySelector('.application-panel:last-child')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      };

      const updatePlanDisplay = () => {
        const checkedPlan = planInputs.find(
          (input) => input instanceof HTMLInputElement && input.checked,
        );
        selectedPlan = checkedPlan?.value || 'free';
        if (planContinue) {
          planContinue.textContent =
            selectedPlan === 'free' ? 'Start with Free Plan' : 'Continue with Gold Plan';
        }
      };

      const chooseSellerType = (nextType) => {
        sellerType = nextType;
        detailsForm.elements.sellerType.value = nextType;
        typeButtons.forEach((button) => {
          button.classList.toggle('active', button.dataset.sellerType === nextType);
        });
        storeOnlyFields.forEach((field) => {
          const control = field.querySelector('input, select');
          field.hidden = nextType !== 'store';
          if (control && (control.name === 'businessType' || control.name === 'catalogReady')) {
            control.required = nextType === 'store';
          }
        });
        const title = document.querySelector('[data-application-title]');
        const nameLabel = document.querySelector('[data-business-name-label]');
        const goldPrice = document.querySelector('[data-gold-price]');
        const goldDuration = document.querySelector('[data-gold-duration]');
        if (title) {
          title.textContent = 'Tell us about your store.';
        }
        if (nameLabel) {
          nameLabel.textContent = 'Business or store name';
        }
        if (goldPrice) {
          goldPrice.textContent = 'NGN 15,000';
        }
        if (goldDuration) {
          goldDuration.textContent = 'Three months for a store or food business.';
        }
        showStep(2);
      };

      typeButtons.forEach((button) => {
        button.addEventListener('click', () => chooseSellerType(button.dataset.sellerType));
      });
      customerLoginButton?.addEventListener('click', () => {
        window.location.assign('/app/');
      });
      planInputs.forEach((input) => input.addEventListener('change', updatePlanDisplay));
      stateSelect?.addEventListener('change', () => {
        if (!(stateSelect instanceof HTMLSelectElement) || !(areaSelect instanceof HTMLSelectElement)) {
          return;
        }

        const lgas = nigeriaLgasByState[stateSelect.value] || [];
        areaSelect.innerHTML =
          '<option value="">Select local government area</option>' +
          lgas.map((lga) => '<option value="' + lga + '">' + lga + '</option>').join('');
        areaSelect.disabled = lgas.length === 0;
      });

      randomSellerButton?.addEventListener('click', () => {
        const seed = Date.now();
        const firstNames = ['Amara', 'Tunde', 'Chidera', 'Amina', 'David', 'Blessing'];
        const lastNames = ['Okafor', 'Adebayo', 'Bello', 'Eze', 'Johnson', 'Adeyemi'];
        const storeNames = ['Fresh Basket Store', 'Everyday Value Mart', 'Prime Choice Shop', 'Neighbourhood Essentials'];
        const streets = ['12 Market Road', '8 Unity Crescent', '24 Freedom Street', '16 Community Avenue'];
        const notes = [
          'Packaged food, drinks, home essentials, and personal care products available for pickup.',
          'Affordable household products and everyday items with stock updated regularly.',
          'Fresh meals and packaged products prepared with clear ingredient and allergy information.',
          'Fashion, electronics accessories, and selected home products ready for customer orders.',
        ];
        const pick = (items, offset = 0) => items[(seed + offset) % items.length];
        const setValue = (name, value) => {
          const field = detailsForm.elements.namedItem(name);
          if (!field || !('value' in field)) return;
          field.value = value;
          field.dispatchEvent(new Event('input', { bubbles: true }));
          field.dispatchEvent(new Event('change', { bubbles: true }));
        };
        const ownerName = pick(firstNames) + ' ' + pick(lastNames, 3);
        const stateNames = Object.keys(nigeriaLgasByState);
        const selectedState = pick(stateNames, 7);

        setValue('ownerName', ownerName);
        setValue('businessName', pick(storeNames, 1));
        setValue('phone', '080' + String(seed).slice(-8));
        setValue('state', selectedState);
        const stateLgas = nigeriaLgasByState[selectedState] || [];
        setValue('area', pick(stateLgas, 4) || '');
        setValue('address', pick(streets, 5) + ', ' + (pick(stateLgas, 4) || selectedState));
        setValue('notes', pick(notes, 6));

        if (sellerType === 'store') {
          setValue('businessType', 'Supermarket / grocery store');
          setValue('cacNumber', 'TEST-' + String(seed).slice(-7));
          setValue('posSystem', 'Excel / manual');
          setValue('catalogReady', 'I can export CSV or Excel');
        }
      });

      document.querySelector('[data-back-to-type]')?.addEventListener('click', () => showStep(1));
      document.querySelector('[data-back-to-details]')?.addEventListener('click', () => showStep(2));
      document.querySelector('[data-back-to-plan]')?.addEventListener('click', () => showStep(3));

      detailsForm.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!detailsForm.reportValidity()) return;
        const freeInput = planInputs.find((input) => input.value === 'free');
        if (freeInput instanceof HTMLInputElement) freeInput.checked = true;
        updatePlanDisplay();
        showStep(3);
      });

      planStep.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!planStep.reportValidity()) return;
        updatePlanDisplay();
        const details = new FormData(detailsForm);
        accountStep.elements.accountEmail.value = String(details.get('email') || '');
        const accountBusiness = document.querySelector('[data-account-business]');
        const accountPlan = document.querySelector('[data-account-plan]');
        if (accountBusiness) {
          accountBusiness.textContent = String(details.get('businessName') || 'Seller application');
        }
        if (accountPlan) {
          accountPlan.textContent =
            selectedPlan === 'free'
              ? 'Free Plan: 3 months, standard placement'
              : sellerType === 'store'
                ? 'Gold Plan: NGN 15,000 for 3 months after approval'
                : 'Gold Plan: NGN 5,000 for 6 months after approval';
        }
        showStep(4);
      });

      const splitSellerName = (value) => {
        const parts = String(value || '').trim().split(/\\s+/).filter(Boolean);
        return {
          firstName: parts[0] || 'View2Connect',
          lastName: parts.slice(1).join(' ') || 'Seller',
        };
      };

      const buildSellerRegistration = () => {
        const details = new FormData(detailsForm);
        const ownerName = String(details.get('ownerName') || '').trim();
        const businessName = String(details.get('businessName') || '').trim();
        const email = String(details.get('email') || '').trim().toLowerCase();
        const phone = String(details.get('phone') || '').trim();
        const area = [details.get('area'), details.get('state')].filter(Boolean).join(', ');
        const { firstName, lastName } = splitSellerName(ownerName);

        return {
          details,
          ownerName,
          businessName,
          email,
          phone,
          area,
          firstName,
          lastName,
          userMetadata: {
            first_name: firstName,
            last_name: lastName,
            full_name: ownerName,
            phone_number: phone,
            role: 'businessOwner',
            estate_id: 'river-park',
            business_name: businessName,
            business_cluster: area,
            accepted_user_agreement: true,
            seller_type: sellerType,
            selected_plan: selectedPlan,
          },
        };
      };

      const requestOtp = async () => {
        const { email, ownerName } = buildSellerRegistration();
        const otpEmail = document.querySelector('[data-otp-email]');
        if (otpEmail) otpEmail.textContent = email;
        otpModal.hidden = false;
        otpCode.value = '';
        setStatus(otpStatus, 'Sending a new code to your email...');
        setTimeout(() => otpCode.focus(), 80);

        if (!supabaseUrl || !supabaseKey) {
          throw new Error('Seller account creation is temporarily unavailable.');
        }

        const headers = {
          apikey: supabaseKey,
          Authorization: 'Bearer ' + supabaseKey,
          'Content-Type': 'application/json',
        };
        const response = await fetch(supabaseUrl + '/functions/v1/request-seller-signup-otp', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            email,
            ownerName,
          }),
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(result.msg || result.message || result.error_description || 'Unable to send the verification code.');
        }

        setStatus(otpStatus, 'Enter the code from your email. The account is still inactive.');
      };

      const createSellerAccount = async (code) => {
        if (!supabaseUrl || !supabaseKey) {
          throw new Error('Seller account creation is temporarily unavailable.');
        }

        const { details, ownerName, businessName, email, phone, area } = buildSellerRegistration();
        const password = String(accountStep.elements.password.value || '');
        const headers = {
          apikey: supabaseKey,
          Authorization: 'Bearer ' + supabaseKey,
          'Content-Type': 'application/json',
        };

        const completeResponse = await fetch(supabaseUrl + '/functions/v1/complete-seller-signup', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            email,
            code,
            password,
            sellerType,
            selectedPlan,
            ownerName,
            businessName,
            phone,
            businessType: String(details.get('businessType') || ''),
            area,
            address: String(details.get('address') || ''),
            cacNumber: String(details.get('cacNumber') || ''),
            posSystem: String(details.get('posSystem') || ''),
            catalogStatus: String(details.get('catalogReady') || ''),
            notes: String(details.get('notes') || ''),
          }),
        });
        const payload = await completeResponse.json().catch(() => ({}));

        if (!completeResponse.ok) {
          throw new Error(payload.error || payload.message || 'Unable to complete seller signup.');
        }

        const passwordLoginResponse = await fetch(supabaseUrl + '/auth/v1/token?grant_type=password', {
          method: 'POST',
          headers,
          body: JSON.stringify({ email, password }),
        });
        const passwordSession = await passwordLoginResponse.json().catch(() => ({}));
        if (!passwordLoginResponse.ok || !passwordSession.access_token) {
          throw new Error('Your email was verified, but the password session could not be created.');
        }

        localStorage.removeItem('view2connect.sellerProfilePending');
        localStorage.setItem(
          'view2connect.sellerWelcomePlan',
          selectedPlan === 'free' ? 'Free Plan' : 'Gold Plan',
        );
        const hash = new URLSearchParams({
          access_token: passwordSession.access_token,
          refresh_token: passwordSession.refresh_token || '',
          expires_in: String(passwordSession.expires_in || 3600),
          token_type: passwordSession.token_type || 'bearer',
        });
        window.location.assign('/${sellerPortalPath}/?welcome=1#' + hash.toString());
      };

      accountStep.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!accountStep.reportValidity()) return;
        const password = String(accountStep.elements.password.value || '');
        const confirmation = String(accountStep.elements.confirmPassword.value || '');
        if (password.length < 8) {
          setStatus(accountStatus, 'Use at least 8 characters for your password.', true);
          return;
        }
        if (password !== confirmation) {
          setStatus(accountStatus, 'The two passwords do not match.', true);
          return;
        }
        try {
          setLoading(createAccountButton, true, 'Sending OTP...');
          setStatus(accountStatus, '');
          await requestOtp();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unable to send the seller OTP.';
          setStatus(
            accountStatus,
            message,
            true,
          );
          setStatus(otpStatus, message, true);
        } finally {
          setLoading(createAccountButton, false);
        }
      });

      document.querySelector('[data-close-otp]')?.addEventListener('click', () => {
        otpModal.hidden = true;
        otpCode.value = '';
        setStatus(otpStatus, '');
      });

      resendOtpButton?.addEventListener('click', async () => {
        try {
          setLoading(resendOtpButton, true, 'Sending...');
          await requestOtp();
          setStatus(otpStatus, 'A new code was sent. It expires in 10 minutes.');
        } catch (error) {
          setStatus(
            otpStatus,
            error instanceof Error ? error.message : 'Unable to resend the code.',
            true,
          );
        } finally {
          setLoading(resendOtpButton, false);
        }
      });

      verifyOtpButton?.addEventListener('click', async () => {
        const code = String(otpCode.value || '').replace(/\\D/g, '').slice(0, 8);
        if (!/^\\d{6,8}$/.test(code)) {
          setStatus(otpStatus, 'Enter the complete code from your email.', true);
          return;
        }

        const { email } = buildSellerRegistration();

        try {
          setLoading(verifyOtpButton, true, 'Verifying...');
          setStatus(otpStatus, '');
          await createSellerAccount(code);
        } catch (error) {
          setStatus(
            otpStatus,
            error instanceof Error ? error.message : 'Unable to verify this account.',
            true,
          );
        } finally {
          setLoading(verifyOtpButton, false);
        }
      });

      otpCode?.addEventListener('input', () => {
        otpCode.value = otpCode.value.replace(/\\D/g, '').slice(0, 8);
        setStatus(otpStatus, '');
      });

      const requestedType = new URLSearchParams(window.location.search).get('sellerType');
      if (requestedType === 'individual') {
        window.location.assign('/app/');
      } else if (requestedType === 'store') {
        chooseSellerType('store');
      }
    })();
  </script>`;
}
