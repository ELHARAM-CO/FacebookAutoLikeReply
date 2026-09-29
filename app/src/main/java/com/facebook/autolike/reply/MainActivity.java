package com.facebook.autolike.reply;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.content.SharedPreferences;
import android.webkit.*;
import android.widget.*;
import android.content.Context;
import android.graphics.Rect;
import android.view.View;
import android.view.ViewTreeObserver;
import android.view.Window;
import android.view.WindowManager;

import java.io.*;
import java.text.SimpleDateFormat;
import java.util.*;

public class MainActivity extends Activity {

    WebView web;
    TextView status, log, counters;
    View controlPanel;
    View controlScroll, resizeHandle;
    float resizeStartY;
    int resizeStartHeight;
    int panelHeight = 0;

    EditText url,
            publicReply,
            privateMessage,
            noMessageReply;

    Spinner limit, delay;
    CheckBox sendPrivate, publicEnabled, doLike;

    Handler handler = new Handler(Looper.getMainLooper());
    SharedPreferences prefs;

    boolean running = false;
    boolean humanCheckMode = false;
    boolean openCommentsAfterLoad = false;
    boolean postPrepared = false;

    int processed = 0;
    int likes = 0;
    int publicReplies = 0;
    int privateSent = 0;
    int polls = 0;

    Runnable worker;

    @Override
    public void onCreate(Bundle b) {
        super.onCreate(b);

        setContentView(R.layout.activity_main);

        bind();
        loadPrefs();
        setupResizablePanel();
        setupWeb();
        setupKeyboardLayout();
        setupHumanCheckWatcher();

        findViewById(R.id.open).setOnClickListener(v -> openPost());

        findViewById(R.id.start).setOnClickListener(v -> start());

        findViewById(R.id.stop).setOnClickListener(
                v -> stop("تم الإيقاف يدويًا.")
        );
    }

    void bind() {

        web = findViewById(R.id.web);
        status = findViewById(R.id.status);
        log = findViewById(R.id.log);
        counters = findViewById(R.id.counters);
        controlPanel = findViewById(R.id.controlScroll);
        controlScroll = findViewById(R.id.controlScroll);
        resizeHandle = findViewById(R.id.resizeHandle);

        url = findViewById(R.id.url);

        publicReply = findViewById(R.id.publicReply);

        privateMessage = findViewById(R.id.privateMessage);

        noMessageReply = findViewById(R.id.noMessageReply);

        limit = findViewById(R.id.limit);
        delay = findViewById(R.id.delay);
        sendPrivate = findViewById(R.id.sendPrivate);
        publicEnabled = findViewById(R.id.publicEnabled);
        doLike = findViewById(R.id.doLike);

        setupSpinners();
    }

    void loadPrefs() {

        prefs = getSharedPreferences("settings", 0);

        url.setText(
                prefs.getString("url", "")
        );

        publicReply.setText(
                prefs.getString(
                        "public",
                        "أهلاً بحضرتك [اسم العميل] ✨\n\n" +
                        "تم إرسال السعر وكافة التفاصيل عبر الرسائل الخاصة 📩"
                )
        );

        privateMessage.setText(
                prefs.getString("private", "")
        );

        noMessageReply.setText(
                prefs.getString(
                        "nomsg",
                        "الرجاء التواصل معنا على الخاص."
                )
        );

        setSpinnerValue(limit, prefs.getInt("limit", 10));
        setSpinnerValue(delay, prefs.getInt("delay", 10));
        doLike.setChecked(prefs.getBoolean("doLike", true));
        sendPrivate.setChecked(prefs.getBoolean("sendPrivate", true));
        publicEnabled.setChecked(prefs.getBoolean("publicEnabled", true));
    }

    void save() {

        prefs.edit()

                .putString(
                        "url",
                        url.getText().toString()
                )

                .putString(
                        "public",
                        publicReply.getText().toString()
                )

                .putString(
                        "private",
                        privateMessage.getText().toString()
                )

                .putString(
                        "nomsg",
                        noMessageReply.getText().toString()
                )

                .putInt("limit", spinnerInt(limit, 10))
                .putInt("delay", Math.max(1, spinnerInt(delay, 10)))
                .putBoolean("doLike", doLike.isChecked())
                .putBoolean("sendPrivate", sendPrivate.isChecked())
                .putBoolean("publicEnabled", publicEnabled.isChecked())
                .putInt("panelHeight", panelHeight)
                .apply();
    }

    void setupSpinners() {
        ArrayList<String> seconds = new ArrayList<>();
        for (int i = 1; i <= 300; i++) seconds.add(String.valueOf(i));
        ArrayList<String> operations = new ArrayList<>();
        for (int i = 1; i <= 1000; i++) operations.add(String.valueOf(i));

        ArrayAdapter<String> secondsAdapter = new ArrayAdapter<String>(this, android.R.layout.simple_spinner_item, seconds) {
            @Override public View getView(int position, View convertView, android.view.ViewGroup parent) {
                TextView v = (TextView) super.getView(position, convertView, parent);
                v.setPadding(dp(8), dp(8), dp(8), dp(8));
                return v;
            }
        };
        secondsAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        delay.setAdapter(secondsAdapter);

        ArrayAdapter<String> operationsAdapter = new ArrayAdapter<String>(this, android.R.layout.simple_spinner_item, operations) {
            @Override public View getView(int position, View convertView, android.view.ViewGroup parent) {
                TextView v = (TextView) super.getView(position, convertView, parent);
                v.setPadding(dp(8), dp(8), dp(8), dp(8));
                return v;
            }
        };
        operationsAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        limit.setAdapter(operationsAdapter);
    }

    void setSpinnerValue(Spinner s, int value) {
        if (s == null || s.getAdapter() == null) return;
        int max = s.getAdapter().getCount();
        int pos = Math.max(0, Math.min(max - 1, value - 1));
        s.setSelection(pos, false);
    }

    int spinnerInt(Spinner s, int d) {
        try { return Integer.parseInt(String.valueOf(s.getSelectedItem())); }
        catch (Exception e) { return d; }
    }

    int num(EditText e, int d) {

        try {

            return Integer.parseInt(
                    e.getText().toString()
            );

        } catch (Exception x) {

            return d;
        }
    }

    void setupResizablePanel() {
        panelHeight = prefs.getInt("panelHeight", 0);
        if (panelHeight > 0) {
            android.view.ViewGroup.LayoutParams lp = controlScroll.getLayoutParams();
            lp.height = panelHeight;
            controlScroll.setLayoutParams(lp);
        }

        resizeHandle.setOnTouchListener((v, event) -> {
            switch (event.getAction()) {
                case android.view.MotionEvent.ACTION_DOWN:
                    resizeStartY = event.getRawY();
                    resizeStartHeight = controlScroll.getHeight();
                    return true;
                case android.view.MotionEvent.ACTION_MOVE:
                    int delta = Math.round(event.getRawY() - resizeStartY);
                    int screenHeight = getResources().getDisplayMetrics().heightPixels;
                    int minPanel = dp(140);
                    int minWeb = dp(120);
                    int maxPanel = Math.max(minPanel, screenHeight - minWeb - dp(110));
                    int newHeight = Math.max(minPanel, Math.min(maxPanel, resizeStartHeight + delta));
                    android.view.ViewGroup.LayoutParams params = controlScroll.getLayoutParams();
                    params.height = newHeight;
                    controlScroll.setLayoutParams(params);
                    panelHeight = newHeight;
                    return true;
                case android.view.MotionEvent.ACTION_UP:
                case android.view.MotionEvent.ACTION_CANCEL:
                    save();
                    return true;
            }
            return true;
        });
    }

    int dp(float value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    void setupWeb() {

        WebSettings s = web.getSettings();

        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);

        // Fit Facebook content to the available WebView width.
        s.setLoadWithOverviewMode(false);
        s.setUseWideViewPort(false);
        web.setInitialScale(0);

        web.setWebViewClient(
                new WebViewClient() {

                    @Override
                    public void onPageFinished(
                            WebView v,
                            String u
                    ) {

                        exitHumanCheckMode();
                        inject();
                        if (openCommentsAfterLoad) {
                            openCommentsAfterLoad = false;
                            handler.postDelayed(() -> web.evaluateJavascript(
                                    "window.__fbAutoOpenComments ? window.__fbAutoOpenComments() : false",
                                    value -> {
                                        if ("true".equals(value)) {
                                            addLog("💬 تم تجهيز قسم التعليقات للمنشور.");
                                        } else {
                                            addLog("⏳ Facebook ما زال يحمّل التعليقات، جارٍ المحاولة مرة أخرى...");
                                        }
                                    }),
                                    1200);
                        }
                    }
                }
        );

        web.setWebChromeClient(
                new WebChromeClient()
        );

        // اترك WebView يتعامل مع اللمس والتمرير بالكامل.
        // لا نضيف أي اعتراض لحركة اللمس لأن Facebook يحتوي على
        // نوافذ منبثقة وحقول إدخال وواجهات تحقق لها scrolling مستقل.
        web.setVerticalScrollBarEnabled(true);
        web.setHorizontalScrollBarEnabled(false);
        web.setScrollbarFadingEnabled(false);
        web.setOverScrollMode(WebView.OVER_SCROLL_ALWAYS);
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        web.setNestedScrollingEnabled(true);

        // لو ظهرت واجهة "تأكيد أنك إنسان"، أخفِ لوحة الإعدادات فورًا
        // ليأخذ Facebook كامل مساحة الشاشة وتظهر أزرار التحقق أسفلها.
        // لا نستهلك اللمسة حتى يظل WebView مسؤولًا عن السحب والضغط.
        web.setOnTouchListener((v, event) -> {
            if (event.getAction() == android.view.MotionEvent.ACTION_DOWN) {
                web.evaluateJavascript(
                        "window.__fbAutoHasHumanCheck ? window.__fbAutoHasHumanCheck() : false",
                        value -> {
                            if ("true".equals(value)) {
                                enterHumanCheckMode();
                            }
                        }
                );
            }
            return false;
        });

        // تأكد من أن نافذة التطبيق تعيد توزيع المساحة عند ظهور لوحة المفاتيح.
        getWindow().setSoftInputMode(
                WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
                        | WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN
        );

        web.loadUrl(
                "https://www.facebook.com/"
        );
    }


    void enterHumanCheckMode() {
        humanCheckMode = true;
        if (controlPanel.getVisibility() != View.GONE) {
            controlPanel.setVisibility(View.GONE);
        }
        if (resizeHandle.getVisibility() != View.GONE) {
            resizeHandle.setVisibility(View.GONE);
        }
        web.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        web.evaluateJavascript(
                "window.__fbAutoBringHumanCheckIntoView ? window.__fbAutoBringHumanCheckIntoView() : false",
                null
        );
    }

    void exitHumanCheckMode() {
        if (!humanCheckMode) return;
        humanCheckMode = false;
        if (controlPanel.getVisibility() != View.VISIBLE) {
            controlPanel.setVisibility(View.VISIBLE);
        }
        if (resizeHandle.getVisibility() != View.VISIBLE) {
            resizeHandle.setVisibility(View.VISIBLE);
        }
    }

    void setupHumanCheckWatcher() {
        final Runnable check = new Runnable() {
            @Override public void run() {
                if (isFinishing()) return;
                web.evaluateJavascript(
                        "window.__fbAutoHasHumanCheck ? window.__fbAutoHasHumanCheck() : false",
                        value -> {
                            if ("true".equals(value)) {
                                enterHumanCheckMode();
                            }
                        }
                );
                handler.postDelayed(this, 700);
            }
        };
        handler.postDelayed(check, 1200);
    }

    void setupKeyboardLayout() {
        final View root = findViewById(android.R.id.content);
        root.getViewTreeObserver().addOnGlobalLayoutListener(
                new ViewTreeObserver.OnGlobalLayoutListener() {
                    @Override
                    public void onGlobalLayout() {
                        Rect r = new Rect();
                        root.getWindowVisibleDisplayFrame(r);
                        int total = root.getRootView().getHeight();
                        int visible = r.height();
                        boolean keyboardVisible = total - visible > total * 0.20f;

                        // إذا كان الكيبورد ظهر بسبب إحدى خانات إعدادات التطبيق
                        // (رابط المنشور أو الردود أو الإعدادات)، لا نخفي لوحة الخانات.
                        // إخفاؤها كان يجعل WebView يظهر مكانها فورًا، فيبدو للمستخدم
                        // وكأن الضغط على الخانة فتح فيسبوك.
                        boolean appFieldFocused =
                                url.hasFocus()
                                || publicReply.hasFocus()
                                || privateMessage.hasFocus()
                                || noMessageReply.hasFocus();

                        if (keyboardVisible && !appFieldFocused) {
                            if (controlPanel.getVisibility() != View.GONE) {
                                controlPanel.setVisibility(View.GONE);
                            }
                        } else if (!humanCheckMode) {
                            if (controlPanel.getVisibility() != View.VISIBLE) {
                                controlPanel.setVisibility(View.VISIBLE);
                            }
                        }
                    }
                }
        );
    }

    void inject() {

        try {

            InputStream in =
                    getAssets().open(
                            "facebook_automation.js"
                    );

            ByteArrayOutputStream out =
                    new ByteArrayOutputStream();

            byte[] buf = new byte[4096];

            int n;

            while (
                    (n = in.read(buf)) != -1
            ) {

                out.write(buf, 0, n);
            }

            String js =
                    new String(
                            out.toByteArray(),
                            "UTF-8"
                    );

            web.evaluateJavascript(
                    js,
                    null
            );

        } catch (Exception e) {

            addLog(
                    "تعذر تجهيز أدوات الصفحة: "
                            + e.getMessage()
            );
        }
    }

    void openPost() {

        save();

        String u =
                url.getText()
                        .toString()
                        .trim();

        if (u.isEmpty()) {

            addLog(
                    "أدخل رابط المنشور أولًا."
            );

            return;
        }

        exitHumanCheckMode();
        openCommentsAfterLoad = true;
        postPrepared = false;
        web.loadUrl(u);

        addLog(
                "فتح المنشور المحدد."
        );
    }

    void start() {

        save();

        if (running) {
            return;
        }

        if (
                url.getText()
                        .toString()
                        .trim()
                        .isEmpty()
        ) {

            addLog(
                    "أدخل رابط المنشور أولًا."
            );

            return;
        }

        if (
                publicEnabled.isChecked()
                &&
                publicReply.getText()
                        .toString()
                        .trim()
                        .isEmpty()
        ) {

            addLog(
                    "اكتب الرد العام أو عطّل الرد العام."
            );

            return;
        }

        if (
                sendPrivate.isChecked()
                &&
                privateMessage.getText()
                        .toString()
                        .trim()
                        .isEmpty()
        ) {

            addLog(
                    "اكتب الرسالة الخاصة أو عطّل إرسال الخاص."
            );

            return;
        }

        if (!doLike.isChecked() && !publicEnabled.isChecked() && !sendPrivate.isChecked()) {
            addLog("اختر عملية واحدة على الأقل: لايك أو رد عام أو إرسال على الخاص.");
            return;
        }

        running = true;

        processed = 0;
        likes = 0;
        publicReplies = 0;
        privateSent = 0;
        polls = 0;

        updateCounters();

        status.setText(
                "🟢 يعمل"
        );

        addLog(
                "بدأت معالجة المنشور الحالي فقط — جاري تجهيز التعليقات واختيار «الأحدث» تلقائيًا."
        );

        worker = new Runnable() {

            @Override
            public void run() {

                if (running) {

                    pollState();
                }
            }
        };

        handler.post(worker);
    }

    void pollState() {

        if (!postPrepared) {
            web.evaluateJavascript(
                    "window.__fbAutoPreparePost ? window.__fbAutoPreparePost() : JSON.stringify({state:\"error\",message:\"أداة تجهيز المنشور غير موجودة.\"})",
                    v -> {
                        if (!running) return;
                        String r = decode(v);
                        if (r.contains("\"state\":\"ready\"")) {
                            postPrepared = true;
                            addLog("✅ " + extractMessage(r, "تم تجهيز التعليقات."));
                            handler.postDelayed(worker, 400);
                        } else if (r.contains("\"state\":\"waiting\"")) {
                            addLog("⏳ " + extractMessage(r, "التعليقات لم تجهز بعد؛ سأحاول مرة أخرى."));
                            handler.postDelayed(worker, 1200);
                        } else if (r.contains("\"state\":\"error\"")) {
                            finish("⚠️ توقف قبل معالجة أي تعليق: " + extractMessage(r, "تعذر تجهيز المنشور."));
                        } else {
                            addLog("⏳ لم تصل نتيجة تجهيز المنشور بعد؛ إعادة المحاولة.");
                            handler.postDelayed(worker, 900);
                        }
                    }
            );
            return;
        }

        String pub =
                q(
                        publicReply
                                .getText()
                                .toString()
                );

        String priv =
                q(
                        privateMessage
                                .getText()
                                .toString()
                );

        String alt =
                q(
                        noMessageReply
                                .getText()
                                .toString()
                );

        String js =
                "window.__fbAutoProcessNext("
                        + pub + ","
                        + priv + ","
                        + alt + ","
                        + sendPrivate.isChecked()
                        + ","
                        + publicEnabled.isChecked()
                        + ","
                        + doLike.isChecked()
                        + ")";

        web.evaluateJavascript(
                js,
                v -> {

                    if (!running) {
                        return;
                    }

                    String r =
                            decode(v);

                    /*
                     * Facebook ما زال يحمّل التعليقات
                     */
                    if (r.contains("\"state\":\"waiting\"")) {
                        polls = 0;
                        handler.postDelayed(worker, 1200);
                        return;
                    }

                    /*
                     * الصفحة غير مدعومة
                     */
                    if (
                            r.contains(
                                    "\"state\":\"unsupported\""
                            )
                    ) {

                        finish(
                                "⚠️ لم يمكن تجهيز صفحة Facebook الحالية."
                        );

                        return;
                    }

                    /*
                     * ما زالت العملية الحالية مشغولة
                     */
                    if (
                            r.contains(
                                    "\"state\":\"busy\""
                            )
                    ) {

                        polls++;

                        if (polls > 40) {

                            finish(
                                    "⚠️ لم تكتمل خطوة العميل في الوقت المتوقع؛ تم الإيقاف للمراجعة."
                            );

                        } else {

                            handler.postDelayed(
                                    worker,
                                    500
                            );
                        }

                        return;
                    }

                    /*
                     * Facebook ينتظر تأكيد نافذة الخاص
                     */
                    if (
                            r.contains(
                                    "\"state\":\"confirm\""
                            )
                    ) {

                        addLog(
                                "⏳ في انتظار نافذة تأكيد Facebook بعد إرسال الخاص."
                        );

                        waitConfirm();

                        return;
                    }

                    /*
                     * انتهت التعليقات
                     */
                    if (
                            r.contains(
                                    "\"state\":\"done\""
                            )
                    ) {

                        finish(
                                "🏁 انتهت التعليقات القابلة للمعالجة في المنشور."
                        );

                        return;
                    }

                    /*
                     * تمت معالجة تعليق بنجاح
                     */
                    if (
                            r.contains(
                                    "\"state\":\"processed\""
                            )
                    ) {

                        processed++;

                        if (
                                r.contains(
                                        "\"like\":true"
                                )
                        ) {

                            likes++;
                        }

                        if (
                                r.contains(
                                        "\"public\":true"
                                )
                        ) {

                            publicReplies++;
                        }

                        if (
                                r.contains(
                                        "\"private\":true"
                                )
                        ) {

                            privateSent++;
                        }

                        updateCounters();

                        addLog(
                                "✅ اكتملت معالجة التعليق رقم "
                                        + processed
                                        + "."
                        );

                        /*
                         * لو وصلنا للعدد المحدد
                         */
                        if (
                                processed
                                >=
                                spinnerInt(limit, 10)
                        ) {

                            finish(
                                    "🏁 تم الوصول إلى العدد المحدد من التعليقات."
                            );

                            return;
                        }

                        handler.postDelayed(
                                worker,
                                Math.max(
                                        3000,
                                        spinnerInt(delay, 10)
                                                * 1000L
                                )
                        );

                        return;
                    }

                    /*
                     * حدث خطأ من JavaScript
                     */
                    if (
                            r.contains(
                                    "\"state\":\"error\""
                            )
                    ) {

                        finish(
                                "⚠️ " + extractMessage(r, "حدث خطأ غير محدد داخل صفحة Facebook.")
                        );

                        return;
                    }

                    /*
                     * لم نحصل على حالة نهائية بعد
                     */
                    handler.postDelayed(
                            worker,
                            700
                    );
                }
        );
    }

    void waitConfirm() {

        handler.postDelayed(
                new Runnable() {

                    int tries = 0;

                    @Override
                    public void run() {

                        if (!running) {
                            return;
                        }

                        tries++;

                        web.evaluateJavascript(
                                "window.__fbAutoConfirmDialog()",
                                v -> {

                                    String r =
                                            decode(v);

                                    if (
                                            r.contains(
                                                    "confirmed"
                                            )
                                    ) {

                                        addLog(
                                                "✅ تم تأكيد نافذة Facebook."
                                        );

                                        polls = 0;

                                        handler.postDelayed(
                                                worker,
                                                Math.max(
                                                        1000,
                                                        spinnerInt(delay, 10)
                                                                * 1000L
                                                )
                                        );

                                    } else if (
                                            tries < 30
                                    ) {

                                        handler.postDelayed(
                                                this,
                                                500
                                        );

                                    } else {

                                        finish(
                                                "⚠️ لم يظهر تأكيد إرسال الخاص؛ تم الإيقاف للمراجعة."
                                        );
                                    }
                                }
                        );
                    }
                },
                500
        );
    }

    String extractMessage(String json, String fallback) {
        try {
            org.json.JSONObject o = new org.json.JSONObject(json);
            String m = o.optString("message", "").trim();
            if (!m.isEmpty()) return m;
        } catch (Exception ignored) {}
        return fallback;
    }

    void finish(String msg) {

        running = false;

        if (worker != null) {

            handler.removeCallbacks(
                    worker
            );
        }

        status.setText(
                "⏹ متوقف"
        );

        addLog(msg);

        addLog(
                "📊 الإجمالي — معالجة: "
                        + processed
                        + " | Likes: "
                        + likes
                        + " | ردود عامة: "
                        + publicReplies
                        + " | خاص: "
                        + privateSent
        );
    }

    void stop(String msg) {

        running = false;

        if (worker != null) {

            handler.removeCallbacks(
                    worker
            );
        }

        status.setText(
                "🔴 متوقف"
        );

        addLog(msg);

        addLog(
                "📊 حتى الآن — معالجة: "
                        + processed
                        + " | Likes: "
                        + likes
                        + " | ردود عامة: "
                        + publicReplies
                        + " | خاص: "
                        + privateSent
        );
    }

    void updateCounters() {

        counters.setText(
                "تمت المعالجة: "
                        + processed
                        + " | Likes: "
                        + likes
                        + " | ردود: "
                        + publicReplies
                        + " | خاص: "
                        + privateSent
        );
    }

    void addLog(String s) {

        String t =
                new SimpleDateFormat(
                        "HH:mm:ss",
                        Locale.getDefault()
                ).format(
                        new Date()
                );

        log.append(
                "\n[" + t + "] " + s
        );

        log.post(
                () -> {

                    android.text.Layout l =
                            log.getLayout();

                    if (l != null) {

                        log.scrollTo(
                                0,
                                Math.max(
                                        0,
                                        l.getLineTop(
                                                l.getLineCount() - 1
                                        )
                                )
                        );
                    }
                }
        );
    }

    String q(String s) {

        return "JSON.parse(\""
                + s
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                + "\")";
    }

    String decode(String v) {

        if (v == null) {
            return "";
        }

        return v
                .replace("\\\"", "\"")
                .replace("\\\\", "\\")
                .replace("\\n", "\n");
    }

    @Override
    public void onBackPressed() {

        if (web.canGoBack()) {

            web.goBack();

        } else {

            super.onBackPressed();
        }
    }
}
