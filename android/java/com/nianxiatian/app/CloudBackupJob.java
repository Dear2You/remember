package com.nianxiatian.app;

import android.app.job.JobParameters;
import android.app.job.JobService;

public class CloudBackupJob extends JobService {
    private JobParameters active;
    @Override public boolean onStartJob(JobParameters params) {
        active = params;
        CloudBackup backup = CloudBackup.get(this);
        backup.worker.execute(() -> {
            boolean retry = backup.upload();
            new android.os.Handler(getMainLooper()).post(() -> {
                if (active != params) return;
                active = null;
                // An edit may have arrived after the worker checked its revision.
                jobFinished(params, retry || backup.hasPending());
            });
        });
        return true;
    }
    @Override public boolean onStopJob(JobParameters params) {
        if (active == params) active = null;
        return true;
    }
}
